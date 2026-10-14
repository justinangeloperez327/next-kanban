import { prisma } from "@next-kanban/database";
import { currentUser } from "@/lib/auth";
import { boardAccess } from "@/lib/board-access";
import { fail } from "@/lib/workspaces";
import { z } from "zod";
type Ctx={params:Promise<{boardId:string}>};
export const filtersSchema=z.object({
 q:z.string().max(100).default(""),
 priority:z.enum(["","LOW","MEDIUM","HIGH","URGENT"]).default(""),
 assigneeId:z.string().max(100).default(""),
 labelId:z.string().max(100).default(""),
 due:z.enum(["","overdue","today","week","none"]).default("")
}).strict();
const input=z.object({name:z.string().trim().min(1).max(60),filters:filtersSchema});
export async function GET(_request:Request,{params}:Ctx){
 const user=await currentUser();if(!user)return fail("Unauthorized",401);
 const {boardId}=await params;if(!await boardAccess(boardId,user.id))return fail("Not found",404);
 const views=await prisma.savedCardView.findMany({where:{boardId,userId:user.id},orderBy:{name:"asc"},select:{id:true,name:true,filters:true}});
 return Response.json({views});
}
export async function POST(request:Request,{params}:Ctx){
 const user=await currentUser();if(!user)return fail("Unauthorized",401);
 const {boardId}=await params;if(!await boardAccess(boardId,user.id))return fail("Not found",404);
 const parsed=input.safeParse(await request.json().catch(()=>null));if(!parsed.success)return fail("Invalid saved view",400);
 const {filters}=parsed.data;
 if(filters.assigneeId&&!(await prisma.boardMember.count({where:{boardId,userId:filters.assigneeId}})))return fail("Invalid assignee",400);
 if(filters.labelId&&!(await prisma.label.count({where:{boardId,id:filters.labelId}})))return fail("Invalid label",400);
 try {
 const view=await prisma.savedCardView.create({data:{boardId,userId:user.id,name:parsed.data.name,filters},select:{id:true,name:true,filters:true}});
 return Response.json({view},{status:201});
 } catch(e) {
 if(typeof e==="object"&&e!==null&&"code" in e&&e.code==="P2002")return fail("A view with that name already exists",409);
 throw e;
 }
}
