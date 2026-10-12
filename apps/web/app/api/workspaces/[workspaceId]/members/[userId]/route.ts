import { prisma } from "@next-kanban/database";
import { currentUser } from "@/lib/auth";
import { fail } from "@/lib/workspaces";
import { z } from "zod";
type Context = { params: Promise<{ workspaceId: string; userId: string }> };
const roleInput = z.object({ role: z.enum(["ADMIN", "MEMBER"]) });
async function manage(workspaceId: string, actorId: string, targetId: string, requestedRole?: "ADMIN" | "MEMBER") {
  return prisma.$transaction(async tx => {
    const actor = await tx.workspaceMember.findUnique({ where: { workspaceId_userId: { workspaceId, userId: actorId } } });
    const target = await tx.workspaceMember.findUnique({ where: { workspaceId_userId: { workspaceId, userId: targetId } } });
    if (!actor || !target) return { code: 404 as const };
    if (actor.role !== "OWNER" && actor.role !== "ADMIN") return { code: 403 as const };
    if (target.role === "OWNER" || (actor.role !== "OWNER" && (target.role === "ADMIN" || requestedRole === "ADMIN"))) return { code: 403 as const };
    if (requestedRole) await tx.workspaceMember.update({ where: { id: target.id }, data: { role: requestedRole } });
    else {
      await tx.workspaceMember.delete({ where: { id: target.id } });
      const boards = await tx.board.findMany({ where: { project: { workspaceId } }, select: { id: true } });
      await tx.boardMember.deleteMany({ where: { userId: targetId, boardId: { in: boards.map(b => b.id) } } });
    }
    return { code: 200 as const };
  });
}
export async function PATCH(request: Request, { params }: Context) {
  const actor = await currentUser();
  if (!actor) return fail("Unauthorized", 401);
  const { workspaceId, userId } = await params;
  const input = roleInput.safeParse(await request.json().catch(() => null));
  if (!input.success) return fail("Invalid role", 400);
  const result = await manage(workspaceId, actor.id, userId, input.data.role);
  if (result.code !== 200) return fail(result.code === 403 ? "Forbidden" : "Not found", result.code);
  return Response.json({ ok: true });
}
export async function DELETE(_request: Request, { params }: Context) {
  const actor = await currentUser();
  if (!actor) return fail("Unauthorized", 401);
  const { workspaceId, userId } = await params;
  const result = await manage(workspaceId, actor.id, userId);
  if (result.code !== 200) return fail(result.code === 403 ? "Forbidden" : "Not found", result.code);
  return Response.json({ ok: true });
}
