import {prisma} from "@next-kanban/database";
import {currentUser} from "@/lib/auth";
import {boardAccess,canEditBoard} from "@/lib/board-access";
import {fail} from "@/lib/workspaces";
import {z} from "zod";
type Ctx={params:Promise<{boardId:string;labelId:string}>};
const input=z.object({name:z.string().trim().min(1).max(40).optional(),color:z.string().regex(/^#[0-9a-fA-F]{6}$/).optional()}).refine(v=>Object.keys(v).length>0);
async function check(boardId:string,labelId:string,userId:string){
 const access=await boardAccess(boardId,userId);
 if(!access)return 404;if(!canEditBoard(access.role))return 403;
 return await prisma.label.count({where:{id:labelId,boardId}})?200:404;
}
export async function PATCH(req:Request,{params}:Ctx){
 const user=await currentUser();if(!user)return fail("Unauthorized",401);
 const {boardId,labelId}=await params;const status=await check(boardId,labelId,user.id);
 if(status!==200)return fail(status===403?"Forbidden":"Not found",status);
 const parsed=input.safeParse(await req.json().catch(()=>null));if(!parsed.success)return fail("Invalid label",400);
 try{const label=await prisma.label.update({where:{id:labelId},data:parsed.data});return Response.json({label});}
 catch(e){if(typeof e==="object"&&e!==null&&"code" in e&&e.code==="P2002")return fail("Label name already exists",409);throw e;}
}
export async function DELETE(_req:Request,{params}:Ctx){
 const user=await currentUser();if(!user)return fail("Unauthorized",401);
 const {boardId,labelId}=await params;const status=await check(boardId,labelId,user.id);
 if(status!==200)return fail(status===403?"Forbidden":"Not found",status);
 await prisma.label.delete({where:{id:labelId}});return Response.json({ok:true});
}
