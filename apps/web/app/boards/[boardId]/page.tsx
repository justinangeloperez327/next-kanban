import { redirect, notFound } from "next/navigation";
import { prisma } from "@next-kanban/database";
import { currentUser } from "@/lib/auth";
import { KanbanBoard } from "@/components/kanban/board";
import { ColumnControls } from "@/components/column-controls";
import { CardManager } from "@/components/card-manager";
import { CardActivityTimeline } from "@/components/card-activity-timeline";
export default async function BoardPage({ params }: { params: Promise<{ boardId: string }> }) {
  const user = await currentUser();
  if (!user) redirect("/login");
  const { boardId } = await params;
  const member = await prisma.boardMember.findUnique({ where: { boardId_userId: { boardId, userId: user.id } } });
  if (!member) notFound();
  const board = await prisma.board.findUnique({ where: { id: boardId }, select: { version: true, columns: { orderBy: { position: "asc" }, select: { id: true, title: true, position: true, _count: { select: { cards: true } } } } } });
  if (!board) notFound();
  return <main className="min-h-screen bg-neutral-950 text-neutral-100"><KanbanBoard boardId={boardId} /><ColumnControls boardId={boardId} version={board.version} canEdit={member.role !== "VIEWER"} initialColumns={board.columns.map(c => ({ id: c.id, title: c.title, position: c.position, cardCount: c._count.cards }))} /><CardManager boardId={boardId} canEdit={member.role !== "VIEWER"} columns={board.columns.map(c => ({ id: c.id, title: c.title }))} /><CardActivityTimeline boardId={boardId} /></main>;
}
