"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
export function LogoutButton() {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  async function logout() {
    setPending(true);
    try {
      const response = await fetch("/api/auth/logout", { method: "POST" });
      if (!response.ok) throw new Error("Logout failed");
      router.replace("/login");
      router.refresh();
    } catch {
      setPending(false);
    }
  }
  return <button type="button" disabled={pending} onClick={logout} className="rounded-md border border-neutral-700 px-3 py-2 text-sm disabled:opacity-50">{pending ? "Signing out..." : "Sign out"}</button>;
}
