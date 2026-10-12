import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { currentUser } from "@/lib/auth";
import { workspacePermission } from "@/lib/workspaces";
import { MemberManager } from "@/components/member-manager";
export default async function MembersPage({ params }: { params: Promise<{ workspaceId: string }> }) {
  const user = await currentUser();
  if (!user) redirect("/login");
  const { workspaceId } = await params;
  const membership = await workspacePermission(workspaceId, user.id);
  if (!membership) notFound();
  return <main className="min-h-screen bg-neutral-950 p-6 text-white md:p-10"><div className="mx-auto max-w-4xl space-y-6"><Link className="text-sm text-neutral-400 hover:text-white" href="/">← Workspaces</Link><div><h1 className="text-2xl font-semibold">Workspace members</h1><p className="mt-1 text-sm text-neutral-400">Manage invitations and permissions.</p></div><MemberManager workspaceId={workspaceId} role={membership.role} currentUserId={user.id} /></div></main>;
}
