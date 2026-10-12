import { prisma } from "@next-kanban/database";
import { currentUser } from "@/lib/auth";
import { fail } from "@/lib/workspaces";
import { boardAccess, canEditBoard } from "@/lib/board-access";
import { z } from "zod";
type Ctx={params:Promise<{boardId:string}>};
const input=z.object({title:z.string().trim().min(1).max(100)});
export async function GET(_req:Request,{params}:Ctx){
 const user=await currentUser();if(!user)return fail("Unauthorized",401);
 const {boardId}=await params;if(!(await boardAccess(boardId,user.id)))return fail("Not found",404);
 return Response.json({columns:await prisma.column.findMany({where:{boardId},orderBy:{position:"asc"}})});
}
export async function POST(req:Request,{params}:Ctx){
 const user=await currentUser();if(!user)return fail("Unauthorized",401);
 const {boardId}=await params;const member=await boardAccess(boardId,user.id);
 if(!member)return fail("Not found",404);if(!canEditBoard(member.role))return fail("Forbidden",403);
 const parsed=input.safeParse(await req.json().catch(()=>null));if(!parsed.success)return fail("Invalid title",400);
 const column=await prisma.$transaction(async tx=>{
  await tx.$queryRaw`SELECT id FROM "Board" WHERE id = ${boardId} FOR UPDATE`;
  const last=await tx.column.findFirst({where:{boardId},orderBy:{position:"desc"}});
  const value=await tx.column.create({data:{boardId,title:parsed.data.title,position:(last?.position??0)+1000}});
  await tx.board.update({where:{id:boardId},data:{version:{increment:1}}});
  return value;
 });
 return Response.json({column},{status:201});
}
