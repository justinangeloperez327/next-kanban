"use client";
import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";

export function AuthForm() {
  const router = useRouter();
  const [mode, setMode] = useState<"login" | "register">("login");
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError("");
    const data = new FormData(event.currentTarget);
    try {
      const response = await fetch("/api/auth/" + mode, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(Object.fromEntries(data.entries())),
      });
      const result = await response.json();
      if (!response.ok) {
        setError(result.error ?? "Authentication failed.");
        return;
      }
      router.push("/");
      router.refresh();
    } catch {
      setError("Unable to connect. Please retry.");
    } finally {
      setPending(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-neutral-950 p-6 text-neutral-100">
      <div className="w-full max-w-sm space-y-6 rounded-xl border border-white/10 bg-neutral-900 p-8">
        <div>
          <h1 className="text-2xl font-semibold">Next Kanban</h1>
          <p className="mt-2 text-sm text-neutral-400">{mode === "login" ? "Sign in to your workspace." : "Create your workspace."}</p>
        </div>
        <form onSubmit={submit} className="space-y-4">
          {mode === "register" && <label className="block text-sm">Name<input required name="name" minLength={2} maxLength={100} className="mt-1 w-full rounded-md border border-neutral-700 bg-neutral-950 p-2" /></label>}
          <label className="block text-sm">Email<input required type="email" name="email" autoComplete="email" className="mt-1 w-full rounded-md border border-neutral-700 bg-neutral-950 p-2" /></label>
          <label className="block text-sm">Password<input required type="password" name="password" minLength={mode === "register" ? 12 : 1} autoComplete={mode === "login" ? "current-password" : "new-password"} className="mt-1 w-full rounded-md border border-neutral-700 bg-neutral-950 p-2" /></label>
          {error && <p role="alert" className="text-sm text-red-400">{error}</p>}
          <button disabled={pending} className="w-full rounded-md bg-blue-600 p-2 font-medium disabled:opacity-50">{pending ? "Working…" : mode === "login" ? "Sign in" : "Create account"}</button>
        </form>
        <button type="button" onClick={() => { setMode(mode === "login" ? "register" : "login"); setError(""); }} className="text-sm text-neutral-400 underline">{mode === "login" ? "Create an account" : "Already have an account? Sign in"}</button>
      </div>
    </main>
  );
}
