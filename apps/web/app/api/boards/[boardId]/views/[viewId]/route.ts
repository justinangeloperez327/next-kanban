import {prisma} from "@next-kanban/database";
import {currentUser} from "@/lib/auth";
import {boardAccess} from "@/lib/board-access";
import {fail} from "@/lib/workspaces";
type Ctx={params:Promise<{boardId:string;viewId:string}>};
export async function DELETE(_request:Request,{params}:Ctx){
 const user=await currentUser();if(!user)return fail("Unauthorized",401);
 const {boardId,viewId}=await params;if(!await boardAccess(boardId,user.id))return fail("Not found",404);
 const removed=await prisma.savedCardView.deleteMany({where:{id:viewId,boardId,userId:user.id}});
 if(!removed.count)return fail("View not found",404);
 return Response.json({ok:true});
}
