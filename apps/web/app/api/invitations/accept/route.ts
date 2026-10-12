import { createHash } from "node:crypto";
import { prisma } from "@next-kanban/database";
import { currentUser } from "@/lib/auth";
import { fail } from "@/lib/workspaces";
import { z } from "zod";
const input = z.object({ token: z.string().min(32).max(256) });
export async function POST(request: Request) {
  const user = await currentUser();
  if (!user) return fail("Unauthorized", 401);
  const parsed = input.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return fail("Invalid invitation", 400);
  const tokenHash = createHash("sha256").update(parsed.data.token).digest("hex");
  const invitation = await prisma.workspaceInvitation.findUnique({ where: { tokenHash } });
  if (!invitation || invitation.expiresAt < new Date() || invitation.email !== user.email.toLowerCase()) return fail("Invalid or expired invitation", 403);
  await prisma.$transaction(async tx => {
    // Only one acceptor can consume a token successfully.
    const consumed = await tx.workspaceInvitation.deleteMany({ where: { id: invitation.id, tokenHash, expiresAt: { gt: new Date() } } });
    if (consumed.count !== 1) throw new Error("Invitation already used");
    await tx.workspaceMember.upsert({
      where: { workspaceId_userId: { workspaceId: invitation.workspaceId, userId: user.id } },
      create: { workspaceId: invitation.workspaceId, userId: user.id, role: invitation.role },
      update: {},
    });
    const boards = await tx.board.findMany({ where: { project: { workspaceId: invitation.workspaceId } }, select: { id: true } });
    for (const board of boards) {
      await tx.boardMember.upsert({
        where: { boardId_userId: { boardId: board.id, userId: user.id } },
        create: { boardId: board.id, userId: user.id, role: invitation.role === "ADMIN" ? "EDITOR" : "VIEWER" },
        update: {},
      });
    }
  });
  return Response.json({ ok: true, workspaceId: invitation.workspaceId });
}
