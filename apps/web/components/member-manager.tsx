"use client";
import { useCallback, useEffect, useState, type FormEvent } from "react";
type Member = { userId: string; role: "OWNER" | "ADMIN" | "MEMBER"; user: { name: string; email: string } };
type Invitation = { id: string; email: string; role: string; expiresAt: string };
export function MemberManager({ workspaceId, role, currentUserId }: { workspaceId: string; role: string; currentUserId: string }) {
  const [members, setMembers] = useState<Member[]>([]);
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [email, setEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<"ADMIN" | "MEMBER">("MEMBER");
  const [inviteUrl, setInviteUrl] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const manage = role === "OWNER" || role === "ADMIN";
  const refresh = useCallback(async () => {
    try {
      const [m, i] = await Promise.all([
        fetch(`/api/workspaces/${workspaceId}/members`, { cache: "no-store" }),
        manage ? fetch(`/api/workspaces/${workspaceId}/invitations`, { cache: "no-store" }) : Promise.resolve(null),
      ]);
      if (!m.ok || (i && !i.ok)) throw new Error("Unable to load membership data.");
      setMembers((await m.json()).members);
      if (i) setInvitations((await i.json()).invitations);
    } catch (e) { setError(e instanceof Error ? e.message : "Request failed"); }
  }, [workspaceId, manage]);
  useEffect(() => { void refresh(); }, [refresh]);
  async function invite(e: FormEvent<HTMLFormElement>) {
    e.preventDefault(); setBusy(true); setError(""); setInviteUrl("");
    try {
      const res = await fetch(`/api/workspaces/${workspaceId}/invitations`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, role: inviteRole }),
      });
      const result = await res.json();
      if (!res.ok) throw new Error(result.error ?? "Unable to invite.");
      setInviteUrl(result.inviteUrl); setEmail(""); await refresh();
    } catch (e) { setError(e instanceof Error ? e.message : "Request failed"); }
    finally { setBusy(false); }
  }
  async function mutate(userId: string, method: "PATCH" | "DELETE", selected?: "ADMIN" | "MEMBER") {
    setBusy(true); setError("");
    try {
      const res = await fetch(`/api/workspaces/${workspaceId}/members/${userId}`, {
        method, headers: { "Content-Type": "application/json" },
        ...(selected ? { body: JSON.stringify({ role: selected }) } : {}),
      });
      if (!res.ok) throw new Error((await res.json()).error ?? "Update failed.");
      await refresh();
    } catch (e) { setError(e instanceof Error ? e.message : "Request failed"); }
    finally { setBusy(false); }
  }
  return <div className="space-y-6">
    {error && <p role="alert" className="rounded-md border border-red-900 p-3 text-sm text-red-400">{error}</p>}
    {manage && <form onSubmit={invite} className="space-y-3 rounded-xl border border-neutral-800 p-5">
      <h2 className="font-medium">Invite a member</h2>
      <div className="flex flex-wrap gap-2">
        <input aria-label="Invitee email" type="email" required value={email} onChange={e => setEmail(e.target.value)} placeholder="Email address" className="min-w-48 flex-1 rounded-md border border-neutral-700 bg-neutral-900 px-3 py-2 text-sm" />
        <select aria-label="Invitation role" value={inviteRole} onChange={e => setInviteRole(e.target.value as "ADMIN" | "MEMBER")} className="rounded-md border border-neutral-700 bg-neutral-900 px-3 py-2 text-sm"><option value="MEMBER">Member</option>{role === "OWNER" && <option value="ADMIN">Admin</option>}</select>
        <button disabled={busy} className="rounded-md bg-blue-600 px-4 py-2 text-sm disabled:opacity-50">Create invitation</button>
      </div>
      {inviteUrl && <div className="space-y-2"><p className="text-xs text-neutral-400">Share this link securely with the invited email address. It is shown only once.</p><div className="flex gap-2"><input readOnly aria-label="Invitation link" value={inviteUrl} className="min-w-0 flex-1 rounded-md border border-neutral-700 bg-neutral-950 p-2 text-xs" /><button type="button" onClick={() => void navigator.clipboard.writeText(inviteUrl)} className="rounded-md border border-neutral-700 px-3 py-2 text-xs">Copy</button></div></div>}
    </form>}
    <section className="space-y-3"><h2 className="font-medium">Members ({members.length})</h2>
      {members.map(m => <div key={m.userId} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-neutral-800 p-4">
        <div><p className="text-sm font-medium">{m.user.name}{m.userId === currentUserId ? " (you)" : ""}</p><p className="text-xs text-neutral-400">{m.user.email} · {m.role}</p></div>
        {manage && m.role !== "OWNER" && m.userId !== currentUserId && !(role === "ADMIN" && m.role === "ADMIN") &&
          <div className="flex gap-2"><select aria-label={`Role for ${m.user.email}`} disabled={busy} value={m.role} onChange={e => void mutate(m.userId, "PATCH", e.target.value as "ADMIN" | "MEMBER")} className="rounded-md border border-neutral-700 bg-neutral-900 p-2 text-xs"><option value="MEMBER">Member</option>{role === "OWNER" && <option value="ADMIN">Admin</option>}</select><button disabled={busy} onClick={() => { if (window.confirm("Remove this member from the workspace?")) void mutate(m.userId, "DELETE"); }} className="rounded-md border border-red-900 px-3 py-2 text-xs text-red-400">Remove</button></div>}
      </div>)}
    </section>
    {manage && <section className="space-y-2"><h2 className="font-medium">Pending invitations</h2>{invitations.map(i => <div key={i.id} className="flex justify-between gap-3 rounded-lg border border-neutral-800 p-3 text-sm"><span>{i.email} · {i.role}</span><span className="text-neutral-500">Expires {new Date(i.expiresAt).toLocaleDateString()}</span></div>)}</section>}
  </div>;
}
