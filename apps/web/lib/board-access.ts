import { prisma } from "@next-kanban/database";
export async function boardAccess(boardId: string, userId: string) {
 const board = await prisma.board.findUnique({where:{id:boardId},select:{id:true,project:{select:{workspaceId:true}}}});
 if (!board) return null;
 const membership = await prisma.boardMember.findUnique({where:{boardId_userId:{boardId,userId}},select:{role:true}});
 if (!membership) return null;
 if (board.project) {
  const workspaceMember = await prisma.workspaceMember.findUnique({where:{workspaceId_userId:{workspaceId:board.project.workspaceId,userId}},select:{id:true}});
  if (!workspaceMember) return null;
 }
 return membership;
}
export const canEditBoard = (role:string) => role==="OWNER" || role==="EDITOR";
