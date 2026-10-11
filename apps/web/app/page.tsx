import { KanbanBoard } from "@/components/kanban/board";

export default function Home() {
  return (
    <main className="min-h-screen bg-neutral-950 text-neutral-100">
      <KanbanBoard boardId="demo-board" />
    </main>
  );
}
