import { prisma } from "@next-kanban/database";
import { currentUser } from "@/lib/auth";
import { fail, workspacePermission } from "@/lib/workspaces";
type Context = { params: Promise<{ workspaceId: string }> };
export async function GET(_request: Request, { params }: Context) {
  const user = await currentUser();
  if (!user) return fail("Unauthorized", 401);
  const { workspaceId } = await params;
  if (!(await workspacePermission(workspaceId, user.id))) return fail("Not found", 404);
  const members = await prisma.workspaceMember.findMany({
    where: { workspaceId },
    select: { userId: true, role: true, createdAt: true, user: { select: { name: true, email: true, avatarUrl: true } } },
    orderBy: { createdAt: "asc" },
  });
  return Response.json({ members });
}
