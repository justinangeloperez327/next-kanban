import { prisma } from "@next-kanban/database";
import { currentUser } from "@/lib/auth";
import { canManage, fail, workspacePermission } from "@/lib/workspaces";
import { z } from "zod";
const input = z.object({ name: z.string().trim().min(2).max(100).optional(), description: z.string().trim().max(1000).nullable().optional() }).refine(v => Object.keys(v).length > 0);
type Context = { params: Promise<{ workspaceId: string }> };
export async function GET(_request: Request, { params }: Context) {
  const user = await currentUser();
  if (!user) return fail("Unauthorized", 401);
  const { workspaceId } = await params;
  if (!(await workspacePermission(workspaceId, user.id))) return fail("Not found", 404);
  const workspace = await prisma.workspace.findUnique({ where: { id: workspaceId }, include: { projects: { orderBy: { createdAt: "asc" }, include: { _count: { select: { boards: true } } } } } });
  if (!workspace) return fail("Not found", 404);
  return Response.json({ workspace });
}
export async function PATCH(request: Request, { params }: Context) {
  const user = await currentUser();
  if (!user) return fail("Unauthorized", 401);
  const { workspaceId } = await params;
  const member = await workspacePermission(workspaceId, user.id);
  if (!member) return fail("Not found", 404);
  if (!canManage(member.role)) return fail("Forbidden", 403);
  const parsed = input.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return fail("Invalid update", 400);
  const result = await prisma.workspace.updateMany({ where: { id: workspaceId }, data: parsed.data });
  if (!result.count) return fail("Not found", 404);
  return Response.json({ ok: true });
}
export async function DELETE(_request: Request, { params }: Context) {
  const user = await currentUser();
  if (!user) return fail("Unauthorized", 401);
  const { workspaceId } = await params;
  const member = await workspacePermission(workspaceId, user.id);
  if (!member) return fail("Not found", 404);
  if (member.role !== "OWNER") return fail("Forbidden", 403);
  await prisma.workspace.deleteMany({ where: { id: workspaceId } });
  return Response.json({ ok: true });
}
