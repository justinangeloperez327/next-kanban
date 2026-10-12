import { prisma } from "@next-kanban/database";
import { currentUser } from "@/lib/auth";
import { fail } from "@/lib/workspaces";
import { boardAccess, canEditBoard } from "@/lib/board-access";
import { z } from "zod";
type Ctx={params:Promise<{boardId:string;columnId:string}>};
const input=z.object({title:z.string().trim().min(1).max(100)});
async function access(boardId:string,columnId:string,userId:string){
 const member=await boardAccess(boardId,userId);
 if(!member)return 404;
 if(!canEditBoard(member.role))return 403;
 const column=await prisma.column.findFirst({where:{id:columnId,boardId},select:{id:true}});
 return column?200:404;
}
export async function PATCH(req:Request,{params}:Ctx){
 const user=await currentUser();if(!user)return fail("Unauthorized",401);
 const {boardId,columnId}=await params;const status=await access(boardId,columnId,user.id);
 if(status!==200)return fail(status===403?"Forbidden":"Not found",status);
 const parsed=input.safeParse(await req.json().catch(()=>null));if(!parsed.success)return fail("Invalid title",400);
 await prisma.column.update({where:{id:columnId},data:{title:parsed.data.title,version:{increment:1}}});
 return Response.json({ok:true});
}
export async function DELETE(_req:Request,{params}:Ctx){
 const user=await currentUser();if(!user)return fail("Unauthorized",401);
 const {boardId,columnId}=await params;const status=await access(boardId,columnId,user.id);
 if(status!==200)return fail(status===403?"Forbidden":"Not found",status);
 const result=await prisma.$transaction(async tx=>{
  await tx.$queryRaw`SELECT id FROM "Column" WHERE id = ${columnId} FOR UPDATE`;
  if(await tx.card.count({where:{columnId}}))return false;
  await tx.column.delete({where:{id:columnId}});
  await tx.board.update({where:{id:boardId},data:{version:{increment:1}}});
  return true;
 });
 if(!result)return fail("Move cards before deleting this column",409);
 return Response.json({ok:true});
}
