import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@next-kanban/database";
import { currentUser } from "@/lib/auth";
import { WorkspaceDashboard } from "@/components/workspace-dashboard";
import { LogoutButton } from "@/components/logout-button";

export default async function Home() {
  const user = await currentUser();
  if (!user) redirect("/login");
  const workspaces = await prisma.workspace.findMany({
    where: { members: { some: { userId: user.id } } },
    include: { projects: { where: { archivedAt: null }, include: { boards: { select: { id: true, title: true } } }, orderBy: { createdAt: "asc" } }, members: { where: { userId: user.id }, select: { role: true } } },
    orderBy: { createdAt: "asc" },
  });
  const legacyBoards = await prisma.board.findMany({
    where: { projectId: null, members: { some: { userId: user.id } } },
    select: { id: true, title: true },
    orderBy: { createdAt: "asc" },
  });
  return (
    <main className="min-h-screen bg-neutral-950 p-6 text-neutral-100 md:p-10">
      <div className="mx-auto max-w-6xl">
        <div className="mb-8 flex items-center justify-between">
          <div><p className="text-xs tracking-widest text-blue-400">NEXT KANBAN</p><h1 className="mt-2 text-2xl font-semibold">Your workspaces</h1><p className="mt-1 text-sm text-neutral-400">Welcome, {user.name}</p></div>
          <LogoutButton />
        </div>
        <WorkspaceDashboard workspaces={workspaces.map(w => ({ id: w.id, name: w.name, role: w.members[0]?.role ?? "MEMBER", projects: w.projects.map(p => ({ id: p.id, name: p.name, description: p.description, archived: !!p.archivedAt, boards: p.boards })) }))} />
        {legacyBoards.length > 0 && <section className="mt-10"><h2 className="mb-3 text-lg">Standalone boards</h2><div className="flex flex-wrap gap-3">{legacyBoards.map(b => <Link key={b.id} className="rounded-lg border border-neutral-800 p-4 text-sm hover:border-blue-500" href={`/boards/${b.id}`}>{b.title}</Link>)}</div></section>}
      </div>
    </main>
  );
}
