import { prisma } from "@next-kanban/database";
import { currentUser } from "@/lib/auth";
import { boardAccess, canEditBoard } from "@/lib/board-access";
import { fail } from "@/lib/workspaces";
import { z } from "zod";
type Ctx={params:Promise<{boardId:string}>};
const input=z.object({name:z.string().trim().min(1).max(40),color:z.string().regex(/^#[0-9a-fA-F]{6}$/).default("#64748b")});
export async function GET(_req:Request,{params}:Ctx){
 const user=await currentUser();if(!user)return fail("Unauthorized",401);
 const {boardId}=await params;if(!(await boardAccess(boardId,user.id)))return fail("Not found",404);
 const [labels,members]=await Promise.all([
  prisma.label.findMany({where:{boardId},orderBy:{name:"asc"},select:{id:true,name:true,color:true}}),
  prisma.boardMember.findMany({where:{boardId},select:{userId:true,user:{select:{name:true,email:true}}}})
 ]);
 return Response.json({labels,members});
}
export async function POST(req:Request,{params}:Ctx){
 const user=await currentUser();if(!user)return fail("Unauthorized",401);
 const {boardId}=await params;const access=await boardAccess(boardId,user.id);
 if(!access)return fail("Not found",404);if(!canEditBoard(access.role))return fail("Forbidden",403);
 const parsed=input.safeParse(await req.json().catch(()=>null));if(!parsed.success)return fail("Invalid label",400);
 try{
  const label=await prisma.label.create({data:{boardId,...parsed.data},select:{id:true,name:true,color:true}});
  return Response.json({label},{status:201});
 }catch(e){
  if(typeof e==="object"&&e!==null&&"code" in e&&e.code==="P2002")return fail("Label name already exists",409);
  throw e;
 }
}
