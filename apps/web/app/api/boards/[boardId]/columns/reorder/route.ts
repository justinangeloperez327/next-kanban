import { prisma } from "@next-kanban/database";
import { currentUser } from "@/lib/auth";
import { fail } from "@/lib/workspaces";
import { boardAccess, canEditBoard } from "@/lib/board-access";
import { z } from "zod";
type Ctx={params:Promise<{boardId:string}>};
const input=z.object({columnIds:z.array(z.string().min(1)).min(1).max(100),baseVersion:z.number().int().nonnegative()});
export async function PUT(req:Request,{params}:Ctx){
 const user=await currentUser();if(!user)return fail("Unauthorized",401);
 const {boardId}=await params;const member=await boardAccess(boardId,user.id);
 if(!member)return fail("Not found",404);if(!canEditBoard(member.role))return fail("Forbidden",403);
 const parsed=input.safeParse(await req.json().catch(()=>null));
 if(!parsed.success || new Set(parsed.data.columnIds).size!==parsed.data.columnIds.length)return fail("Invalid order",400);
 const outcome=await prisma.$transaction(async tx=>{
  await tx.$queryRaw`SELECT id FROM "Board" WHERE id = ${boardId} FOR UPDATE`;
  const board=await tx.board.findUnique({where:{id:boardId},select:{version:true}});
  if(!board || board.version!==parsed.data.baseVersion)return "CONFLICT";
  const columns=await tx.column.findMany({where:{boardId},select:{id:true}});
  const ids=parsed.data.columnIds;
  if(columns.length!==ids.length || columns.some(c=>!ids.includes(c.id)))return "INVALID";
  for(const [index,id] of ids.entries())await tx.column.update({where:{id},data:{position:(index+1)*1000,version:{increment:1}}});
  await tx.board.update({where:{id:boardId},data:{version:{increment:1}}});
  return "OK";
 });
 if(outcome!=="OK")return fail(outcome==="CONFLICT"?"Board changed; refresh before reordering":"Invalid columns",outcome==="CONFLICT"?409:400);
 return Response.json({ok:true,version:parsed.data.baseVersion+1});
}
