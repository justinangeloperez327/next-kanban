import { redirect, notFound } from "next/navigation";
import { prisma } from "@next-kanban/database";
import { currentUser } from "@/lib/auth";
import { KanbanBoard } from "@/components/kanban/board";
export default async function BoardPage({ params }: { params: Promise<{ boardId: string }> }) {
  const user = await currentUser();
  if (!user) redirect("/login");
  const { boardId } = await params;
  const member = await prisma.boardMember.findUnique({ where: { boardId_userId: { boardId, userId: user.id } } });
  if (!member) notFound();
  return <main className="min-h-screen bg-neutral-950 text-neutral-100"><KanbanBoard boardId={boardId} /></main>;
}
