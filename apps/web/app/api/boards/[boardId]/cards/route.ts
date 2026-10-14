import { prisma } from "@next-kanban/database";
import { currentUser } from "@/lib/auth";
import { boardAccess, canEditBoard } from "@/lib/board-access";
import { fail } from "@/lib/workspaces";
import { z } from "zod";

type Context = { params: Promise<{ boardId: string }> };
const createInput = z.object({
  columnId: z.string().min(1),
  title: z.string().trim().min(1).max(200),
  description: z.string().trim().max(10000).nullable().optional(),
});
export async function GET(_request: Request, { params }: Context) {
  const user = await currentUser();
  if (!user) return fail("Unauthorized", 401);
  const { boardId } = await params;
  if (!(await boardAccess(boardId, user.id))) return fail("Not found", 404);
  const searchParams = new URL(_request.url).searchParams;
  const priority = searchParams.get("priority");
  const assigneeId = searchParams.get("assigneeId");
  const labelId = searchParams.get("labelId");
  const query = searchParams.get("q")?.trim().slice(0,100);
  const due = searchParams.get("due");
  const now = new Date();
  const todayStart = new Date(Date.UTC(now.getUTCFullYear(),now.getUTCMonth(),now.getUTCDate()));
  const tomorrow = new Date(todayStart.getTime()+86400000);
  const weekEnd = new Date(todayStart.getTime()+7*86400000);
  const dueWhere = due==="overdue" ? {dueAt:{lt:todayStart}} : due==="today" ? {dueAt:{gte:todayStart,lt:tomorrow}} : due==="week" ? {dueAt:{gte:todayStart,lt:weekEnd}} : due==="none" ? {dueAt:null} : {};
  const cards = await prisma.card.findMany({
    where: { column: { boardId },...dueWhere, ...(priority && ["LOW","MEDIUM","HIGH","URGENT"].includes(priority) ? {priority: priority as "LOW"|"MEDIUM"|"HIGH"|"URGENT"} : {}), ...(assigneeId ? {assigneeId}:{}),...(labelId?{labels:{some:{labelId}}}:{}),...(query?{OR:[{title:{contains:query,mode:"insensitive" as const}},{description:{contains:query,mode:"insensitive" as const}}]}:{}) },
    include: { assignee: {select:{id:true,name:true,email:true}}, labels:{include:{label:true}} },
    orderBy: [{ column: { position: "asc" } }, { position: "asc" }],
  });
  return Response.json({ cards });
}
export async function POST(request: Request, { params }: Context) {
  const user = await currentUser();
  if (!user) return fail("Unauthorized", 401);
  const { boardId } = await params;
  const member = await boardAccess(boardId, user.id);
  if (!member) return fail("Not found", 404);
  if (!canEditBoard(member.role)) return fail("Forbidden", 403);
  const parsed = createInput.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return fail("Invalid card data", 400);
  const { columnId, title, description } = parsed.data;
  const result = await prisma.$transaction(async tx => {
    await tx.$queryRaw`SELECT id FROM "Board" WHERE id = ${boardId} FOR UPDATE`;
    const column = await tx.column.findFirst({ where: { id: columnId, boardId }, select: { id: true } });
    if (!column) return null;
    const last = await tx.card.findFirst({ where: { columnId }, orderBy: { position: "desc" }, select: { position: true } });
    const card = await tx.card.create({ data: { columnId, title, description: description ?? null, position: (last?.position ?? 0) + 1000, createdById: user.id } });
    await tx.board.update({ where: { id: boardId }, data: { version: { increment: 1 } } });
    return card;
  });
  if (!result) return fail("Column not found", 404);
  return Response.json({ card: result }, { status: 201 });
}
