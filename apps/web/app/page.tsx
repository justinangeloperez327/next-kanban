import { redirect } from "next/navigation";
import { prisma } from "@next-kanban/database";
import { currentUser } from "@/lib/auth";
import { KanbanBoard } from "@/components/kanban/board";

export default async function Home() {
  const user = await currentUser();
  if (!user) redirect("/login");
  const membership = await prisma.boardMember.findFirst({
    where: { userId: user.id },
    select: { boardId: true },
    orderBy: { createdAt: "asc" },
  });
  if (!membership) return <main className="p-10 text-neutral-100">No boards available.</main>;
  return <main className="min-h-screen bg-neutral-950 text-neutral-100"><KanbanBoard boardId={membership.boardId} /></main>;
}
