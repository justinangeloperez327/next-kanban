import { prisma } from "@next-kanban/database";
import { currentUser } from "@/lib/auth";
import { boardAccess, canEditBoard } from "@/lib/board-access";
import { fail } from "@/lib/workspaces";
import { z } from "zod";
type Context = { params: Promise<{ boardId: string; cardId: string }> };
const updateInput = z.object({
 title: z.string().trim().min(1).max(200).optional(),
 description: z.string().trim().max(10000).nullable().optional(),
 priority: z.enum(["LOW","MEDIUM","HIGH","URGENT"]).optional(),
 dueAt: z.iso.datetime({offset:true}).nullable().optional(),
 assigneeId: z.string().min(1).nullable().optional(),
 labelIds: z.array(z.string().min(1)).max(20).optional(),
 baseVersion: z.number().int().nonnegative(),
}).refine(data => Object.keys(data).some(key => key !== "baseVersion"));
export async function GET(_req: Request, { params }: Context) {
 const user = await currentUser(); if (!user) return fail("Unauthorized",401);
 const { boardId, cardId } = await params;
 if (!(await boardAccess(boardId,user.id))) return fail("Not found",404);
 const card = await prisma.card.findFirst({ where:{id:cardId,column:{boardId}}, include:{ assignee:{select:{id:true,name:true,email:true}}, labels:{include:{label:true}} } });
 if (!card) return fail("Not found",404);
 return Response.json({card});
}
export async function PATCH(req: Request, { params }: Context) {
 const user = await currentUser(); if (!user) return fail("Unauthorized",401);
 const {boardId,cardId}=await params;
 const role=await boardAccess(boardId,user.id);
 if(!role)return fail("Not found",404);
 if(!canEditBoard(role.role))return fail("Forbidden",403);
 const parsed=updateInput.safeParse(await req.json().catch(()=>null));if(!parsed.success)return fail("Invalid card update",400);
 const {baseVersion,labelIds,assigneeId,dueAt,...fields}=parsed.data;
 if (assigneeId !== undefined && assigneeId !== null) {
  const allowed=await prisma.boardMember.findUnique({where:{boardId_userId:{boardId,userId:assigneeId}},select:{id:true}});
  if(!allowed)return fail("Assignee must be a board member",400);
 }
 if(labelIds !== undefined) {
  if(new Set(labelIds).size!==labelIds.length)return fail("Duplicate labels",400);
  const count=await prisma.label.count({where:{boardId,id:{in:labelIds}}});
  if(count!==labelIds.length)return fail("Labels must belong to this board",400);
 }
 const outcome=await prisma.$transaction(async tx=>{
  const existing=await tx.card.findFirst({where:{id:cardId,column:{boardId}},include:{labels:true}});
  if(!existing||existing.version!==baseVersion)return null;
  const updated=await tx.card.updateMany({where:{id:cardId,version:baseVersion,column:{boardId}},data:{...fields,...(assigneeId===undefined?{}:{assigneeId}),...(dueAt===undefined?{}:{dueAt:dueAt===null?null:new Date(dueAt)}),version:{increment:1}}});
  if(!updated.count)return null;
  if(labelIds!==undefined){
   await tx.cardLabel.deleteMany({where:{cardId}});
   if(labelIds.length)await tx.cardLabel.createMany({data:labelIds.map(labelId=>({cardId,labelId}))});
  }
  const changes:Record<string,unknown>={};
  if(fields.title!==undefined&&fields.title!==existing.title)changes.title={from:existing.title,to:fields.title};
  if(fields.description!==undefined&&fields.description!==existing.description)changes.description={changed:true};
  if(fields.priority!==undefined&&fields.priority!==existing.priority)changes.priority={from:existing.priority,to:fields.priority};
  if(assigneeId!==undefined&&assigneeId!==existing.assigneeId)changes.assigneeId={from:existing.assigneeId,to:assigneeId};
  if(dueAt!==undefined&&dueAt!==(existing.dueAt?.toISOString()??null))changes.dueAt={from:existing.dueAt?.toISOString()??null,to:dueAt};
  if(labelIds!==undefined){
   const before=existing.labels.map(item=>item.labelId).sort();
   const after=[...labelIds].sort();
   if(JSON.stringify(before)!==JSON.stringify(after))changes.labels={from:before,to:after};
  }
  if(Object.keys(changes).length)await tx.cardActivity.create({data:{boardId,cardId,cardTitle:fields.title??existing.title,actorId:user.id,action:"updated",details:changes}});
  return tx.card.findUnique({where:{id:cardId},include:{assignee:{select:{id:true,name:true,email:true}},labels:{include:{label:true}}}});
 });
 if(!outcome)return fail("Card not found or changed; refresh and retry",409);
 const card=outcome;
 return Response.json({card});
}
export async function DELETE(req: Request, { params }: Context) {
 const user = await currentUser(); if(!user)return fail("Unauthorized",401);
 const {boardId,cardId}=await params;
 const role=await boardAccess(boardId,user.id);if(!role)return fail("Not found",404);
 if(!canEditBoard(role.role))return fail("Forbidden",403);
 const url=new URL(req.url);
 const baseVersion=Number(url.searchParams.get("version"));
 if(!Number.isSafeInteger(baseVersion)||baseVersion<0||!url.searchParams.has("version"))return fail("Card version required",400);
 const deleted=await prisma.$transaction(async tx=>{
  const existing=await tx.card.findFirst({where:{id:cardId,version:baseVersion,column:{boardId}},select:{id:true,title:true}});
  if(!existing)return false;
  const result=await tx.card.deleteMany({where:{id:cardId,version:baseVersion,column:{boardId}}});
  if(!result.count)return false;
  await tx.cardActivity.create({data:{boardId,cardTitle:existing.title,actorId:user.id,action:"deleted",details:{cardId}}});
  return true;
 });
 if(!deleted)return fail("Card not found or changed; refresh and retry",409);
 return Response.json({ok:true});
}
