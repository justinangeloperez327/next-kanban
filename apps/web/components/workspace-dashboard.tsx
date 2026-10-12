"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
type Project = { id: string; name: string; description: string | null; boards: { id: string; title: string }[] };
type Workspace = { id: string; name: string; role: string; projects: Project[] };
export function WorkspaceDashboard({ workspaces }: { workspaces: Workspace[] }) {
  const router = useRouter();
  const [workspaceName, setWorkspaceName] = useState("");
  const [projectNames, setProjectNames] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function send(url: string, data: object) {
    setBusy(true); setError("");
    try {
      const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) });
      if (!res.ok) { const body = await res.json(); throw new Error(body.error ?? "Request failed"); }
      router.refresh();
      return true;
    } catch (err) { setError(err instanceof Error ? err.message : "Request failed"); return false; }
    finally { setBusy(false); }
  }
  async function addWorkspace(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (await send("/api/workspaces", { name: workspaceName })) setWorkspaceName("");
  }
  async function addProject(event: FormEvent<HTMLFormElement>, workspaceId: string) {
    event.preventDefault();
    if (await send(`/api/workspaces/${workspaceId}/projects`, { name: projectNames[workspaceId] })) setProjectNames(s => ({ ...s, [workspaceId]: "" }));
  }
  return <div className="space-y-7">
    {error && <p role="alert" className="rounded-md border border-red-800 p-3 text-sm text-red-400">{error}</p>}
    <form onSubmit={addWorkspace} className="flex max-w-lg gap-2"><input aria-label="New workspace name" value={workspaceName} onChange={e => setWorkspaceName(e.target.value)} minLength={2} maxLength={100} required placeholder="New workspace name" className="min-w-0 flex-1 rounded-md border border-neutral-700 bg-neutral-900 px-3 py-2 text-sm" /><button disabled={busy} className="rounded-md bg-blue-600 px-4 py-2 text-sm disabled:opacity-50">Create workspace</button></form>
    {workspaces.map(w => <section key={w.id} className="rounded-xl border border-neutral-800 p-5">
      <div className="flex items-center justify-between"><h2 className="text-lg font-medium">{w.name}</h2><div className="flex items-center gap-3"><span className="text-xs text-neutral-500">{w.role}</span><Link className="text-xs text-blue-400 hover:underline" href={`/workspaces/${w.id}/members`}>Members</Link></div></div>
      <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {w.projects.map(p => <div key={p.id} className="rounded-lg border border-neutral-800 bg-neutral-900 p-4"><h3 className="font-medium">{p.name}</h3><p className="mt-1 text-sm text-neutral-500">{p.description ?? "Project board"}</p><div className="mt-4 flex flex-wrap gap-2">{p.boards.map(b => <Link key={b.id} href={`/boards/${b.id}`} className="rounded-md bg-neutral-800 px-3 py-2 text-xs hover:bg-neutral-700">Open {b.title}</Link>)}</div></div>)}
      </div>
      {(w.role === "OWNER" || w.role === "ADMIN") && <form className="mt-5 flex max-w-md gap-2" onSubmit={e => addProject(e, w.id)}><input required minLength={2} maxLength={100} placeholder="New project" aria-label={`New project in ${w.name}`} value={projectNames[w.id] ?? ""} onChange={e => setProjectNames(s => ({ ...s, [w.id]: e.target.value }))} className="min-w-0 flex-1 rounded-md border border-neutral-700 bg-neutral-950 px-3 py-2 text-sm" /><button disabled={busy} className="rounded-md border border-neutral-700 px-3 py-2 text-sm disabled:opacity-50">Add project</button></form>}
    </section>)}
  </div>;
}
