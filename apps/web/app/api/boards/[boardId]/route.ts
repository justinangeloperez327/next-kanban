import { prisma } from "@next-kanban/database";
import { currentUser } from "@/lib/auth";
import { fail } from "@/lib/workspaces";
import { boardAccess, canEditBoard } from "@/lib/board-access";
import { z } from "zod";
type Ctx={params:Promise<{boardId:string}>};
const input=z.object({title:z.string().trim().min(2).max(120)});
export async function GET(_req:Request,{params}:Ctx){
 const user=await currentUser();if(!user)return fail("Unauthorized",401);
 const {boardId}=await params;if(!(await boardAccess(boardId,user.id)))return fail("Not found",404);
 const board=await prisma.board.findUnique({where:{id:boardId},include:{columns:{orderBy:{position:"asc"},include:{_count:{select:{cards:true}}}}}});
 return Response.json({board});
}
export async function PATCH(req:Request,{params}:Ctx){
 const user=await currentUser();if(!user)return fail("Unauthorized",401);
 const {boardId}=await params;const member=await boardAccess(boardId,user.id);
 if(!member)return fail("Not found",404);if(!canEditBoard(member.role))return fail("Forbidden",403);
 const data=input.safeParse(await req.json().catch(()=>null));if(!data.success)return fail("Invalid title",400);
 await prisma.board.update({where:{id:boardId},data:{title:data.data.title,version:{increment:1}}});
 return Response.json({ok:true});
}
export async function DELETE(_req:Request,{params}:Ctx){
 const user=await currentUser();if(!user)return fail("Unauthorized",401);
 const {boardId}=await params;const member=await boardAccess(boardId,user.id);
 if(!member)return fail("Not found",404);if(member.role!=="OWNER")return fail("Forbidden",403);
 await prisma.board.delete({where:{id:boardId}});
 return Response.json({ok:true});
}
