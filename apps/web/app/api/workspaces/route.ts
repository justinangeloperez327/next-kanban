import { prisma } from "@next-kanban/database";
import { currentUser } from "@/lib/auth";
import { fail } from "@/lib/workspaces";
import { z } from "zod";
const input = z.object({ name: z.string().trim().min(2).max(100), description: z.string().trim().max(1000).optional() });
export async function GET() {
  const user = await currentUser();
  if (!user) return fail("Unauthorized", 401);
  const workspaces = await prisma.workspace.findMany({
    where: { members: { some: { userId: user.id } } },
    include: { members: { where: { userId: user.id }, select: { role: true } }, _count: { select: { projects: true } } },
    orderBy: { createdAt: "asc" },
  });
  return Response.json({ workspaces });
}
export async function POST(request: Request) {
  const user = await currentUser();
  if (!user) return fail("Unauthorized", 401);
  const parsed = input.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return fail("Invalid workspace details", 400);
  const workspace = await prisma.workspace.create({
    data: { ...parsed.data, slug: crypto.randomUUID(), members: { create: { userId: user.id, role: "OWNER" } } },
  });
  return Response.json({ workspace }, { status: 201 });
}
