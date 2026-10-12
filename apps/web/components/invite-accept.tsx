"use client";
import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
export function InviteAccept({ token }: { token: string }) {
  const router = useRouter();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  async function accept() {
    setBusy(true); setError("");
    try {
      const res = await fetch("/api/invitations/accept", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ token }) });
      if (res.status === 401) { router.push("/login"); return; }
      if (!res.ok) throw new Error((await res.json()).error ?? "Unable to accept");
      router.push("/"); router.refresh();
    } catch (e) { setError(e instanceof Error ? e.message : "Unable to accept"); setBusy(false); }
  }
  return <main className="flex min-h-screen items-center justify-center bg-neutral-950 p-6 text-white"><div className="w-full max-w-sm space-y-4 rounded-xl border border-neutral-800 p-8"><h1 className="text-xl font-semibold">Workspace invitation</h1><p className="text-sm text-neutral-400">Sign in with the invited email address, then accept the invitation.</p>{error && <p role="alert" className="text-sm text-red-400">{error}</p>}<button disabled={busy} onClick={accept} className="w-full rounded-md bg-blue-600 px-4 py-2 disabled:opacity-50">{busy ? "Accepting…" : "Accept invitation"}</button><Link href="/login" className="block text-center text-sm text-neutral-400 underline">Sign in</Link></div></main>;
}
