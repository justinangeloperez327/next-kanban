import { prisma } from "@next-kanban/database";
export async function workspacePermission(workspaceId: string, userId: string) {
  return prisma.workspaceMember.findUnique({
    where: { workspaceId_userId: { workspaceId, userId } },
    select: { role: true },
  });
}
export function canManage(role?: string | null) {
  return role === "OWNER" || role === "ADMIN";
}
export const fail = (message: string, status: number) => Response.json({ error: message }, { status });
export function isUniqueError(error: unknown) {
  return typeof error === "object" && error !== null && "code" in error && error.code === "P2002";
}
