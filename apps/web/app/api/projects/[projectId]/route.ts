import { prisma } from "@next-kanban/database";
import { currentUser } from "@/lib/auth";
import { canManage, fail, workspacePermission } from "@/lib/workspaces";
import { z } from "zod";
const input = z.object({ name: z.string().trim().min(2).max(100).optional(), description: z.string().trim().max(1000).nullable().optional(), archived: z.boolean().optional() }).refine(v => Object.keys(v).length > 0);
type Context = { params: Promise<{ projectId: string }> };
async function authorized(projectId: string, userId: string) {
  const project = await prisma.project.findUnique({ where: { id: projectId }, select: { workspaceId: true } });
  if (!project) return null;
  const membership = await workspacePermission(project.workspaceId, userId);
  return membership ? { project, membership } : null;
}
export async function GET(_request: Request, { params }: Context) {
  const user = await currentUser();
  if (!user) return fail("Unauthorized", 401);
  const { projectId } = await params;
  if (!(await authorized(projectId, user.id))) return fail("Not found", 404);
  const project = await prisma.project.findUnique({ where: { id: projectId }, include: { boards: { select: { id: true, title: true } } } });
  return Response.json({ project });
}
export async function PATCH(request: Request, { params }: Context) {
  const user = await currentUser();
  if (!user) return fail("Unauthorized", 401);
  const { projectId } = await params;
  const access = await authorized(projectId, user.id);
  if (!access) return fail("Not found", 404);
  if (!canManage(access.membership.role)) return fail("Forbidden", 403);
  const parsed = input.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return fail("Invalid update", 400);
  const { archived, ...data } = parsed.data;
  await prisma.project.update({ where: { id: projectId }, data: { ...data, ...(archived === undefined ? {} : { archivedAt: archived ? new Date() : null }) } });
  return Response.json({ ok: true });
}
export async function DELETE(_request: Request, { params }: Context) {
  const user = await currentUser();
  if (!user) return fail("Unauthorized", 401);
  const { projectId } = await params;
  const access = await authorized(projectId, user.id);
  if (!access) return fail("Not found", 404);
  if (!canManage(access.membership.role)) return fail("Forbidden", 403);
  // Boards remain accessible by their existing memberships after project deletion.
  await prisma.project.delete({ where: { id: projectId } });
  return Response.json({ ok: true });
}
