import { prisma } from "@next-kanban/database";
import { currentUser } from "@/lib/auth";
import { boardAccess } from "@/lib/board-access";
import { fail } from "@/lib/workspaces";
type Context={params:Promise<{boardId:string}>};
export async function GET(request:Request,{params}:Context){
 const user=await currentUser();if(!user)return fail("Unauthorized",401);
 const {boardId}=await params;if(!(await boardAccess(boardId,user.id)))return fail("Not found",404);
 const url=new URL(request.url);
 const cardId=url.searchParams.get("cardId")||undefined;
 const cursor=url.searchParams.get("cursor")||undefined;
 if(cursor&&cursor.length>100)return fail("Invalid cursor",400);
 const activities=await prisma.cardActivity.findMany({
  where:{boardId,...(cardId?{cardId}:{} )},
  orderBy:[{createdAt:"desc"},{id:"desc"}],take:51,
  ...(cursor?{cursor:{id:cursor},skip:1}:{}),
  select:{id:true,cardId:true,cardTitle:true,action:true,details:true,createdAt:true,actor:{select:{id:true,name:true}}}
 });
 const hasMore=activities.length>50;
 const items=activities.slice(0,50);
 return Response.json({activities:items,nextCursor:hasMore?items.at(-1)?.id:null});
}
