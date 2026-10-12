import { randomBytes, createHash } from "node:crypto";
import { prisma } from "@next-kanban/database";
import { currentUser } from "@/lib/auth";
import { canManage, fail, workspacePermission } from "@/lib/workspaces";
import { z } from "zod";
type Context = { params: Promise<{ workspaceId: string }> };
const input = z.object({ email: z.email().max(254).transform(e => e.trim().toLowerCase()), role: z.enum(["ADMIN", "MEMBER"]).default("MEMBER") });
export async function GET(_request: Request, { params }: Context) {
  const user = await currentUser();
  if (!user) return fail("Unauthorized", 401);
  const { workspaceId } = await params;
  const member = await workspacePermission(workspaceId, user.id);
  if (!member) return fail("Not found", 404);
  if (!canManage(member.role)) return fail("Forbidden", 403);
  const invitations = await prisma.workspaceInvitation.findMany({ where: { workspaceId }, select: { id: true, email: true, role: true, expiresAt: true, createdAt: true }, orderBy: { createdAt: "desc" } });
  return Response.json({ invitations });
}
export async function POST(request: Request, { params }: Context) {
  const user = await currentUser();
  if (!user) return fail("Unauthorized", 401);
  const { workspaceId } = await params;
  const member = await workspacePermission(workspaceId, user.id);
  if (!member) return fail("Not found", 404);
  if (!canManage(member.role)) return fail("Forbidden", 403);
  const parsed = input.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return fail("Invalid invitation", 400);
  if (parsed.data.role === "ADMIN" && member.role !== "OWNER") return fail("Forbidden", 403);
  const existingUser = await prisma.user.findUnique({ where: { email: parsed.data.email }, select: { id: true } });
  if (existingUser && await workspacePermission(workspaceId, existingUser.id)) return fail("Already a member", 409);
  const token = randomBytes(32).toString("base64url");
  const tokenHash = createHash("sha256").update(token).digest("hex");
  const expiresAt = new Date(Date.now() + 7 * 86400_000);
  await prisma.workspaceInvitation.upsert({
    where: { workspaceId_email: { workspaceId, email: parsed.data.email } },
    create: { workspaceId, email: parsed.data.email, role: parsed.data.role, tokenHash, expiresAt, createdById: user.id },
    update: { role: parsed.data.role, tokenHash, expiresAt, createdById: user.id },
  });
  // No email provider is configured. Return the link to the authorized inviter once.
  const origin = new URL(request.url).origin;
  return Response.json({ inviteUrl: `${origin}/invite/${token}`, expiresAt }, { status: 201, headers: { "Cache-Control": "no-store" } });
}
