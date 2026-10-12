import { prisma } from "@next-kanban/database";
import { currentUser } from "@/lib/auth";
import { canManage, fail, workspacePermission } from "@/lib/workspaces";
import { z } from "zod";
const input = z.object({ name: z.string().trim().min(2).max(100), description: z.string().trim().max(1000).optional() });
type Context = { params: Promise<{ workspaceId: string }> };
export async function GET(_request: Request, { params }: Context) {
  const user = await currentUser();
  if (!user) return fail("Unauthorized", 401);
  const { workspaceId } = await params;
  if (!(await workspacePermission(workspaceId, user.id))) return fail("Not found", 404);
  const projects = await prisma.project.findMany({ where: { workspaceId }, include: { _count: { select: { boards: true } } }, orderBy: { createdAt: "asc" } });
  return Response.json({ projects });
}
export async function POST(request: Request, { params }: Context) {
  const user = await currentUser();
  if (!user) return fail("Unauthorized", 401);
  const { workspaceId } = await params;
  const membership = await workspacePermission(workspaceId, user.id);
  if (!membership) return fail("Not found", 404);
  if (!canManage(membership.role)) return fail("Forbidden", 403);
  const parsed = input.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return fail("Invalid project details", 400);
  const project = await prisma.project.create({ data: { ...parsed.data, workspaceId, slug: crypto.randomUUID(), boards: { create: { title: parsed.data.name, slug: crypto.randomUUID(), members: { create: { userId: user.id, role: "OWNER" } }, columns: { create: [{ title: "To do", position: 1000 }, { title: "In progress", position: 2000 }, { title: "Done", position: 3000 }] } } } }, include: { boards: { select: { id: true } } } });
  return Response.json({ project }, { status: 201 });
}
