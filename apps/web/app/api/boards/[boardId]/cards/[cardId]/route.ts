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
 const updated=await prisma.card.updateMany({where:{id:cardId,version:baseVersion,column:{boardId}},data:{...fields,...(assigneeId===undefined?{}:{assigneeId}),...(dueAt===undefined?{}:{dueAt:dueAt===null?null:new Date(dueAt)}),version:{increment:1}}});
 if(!updated.count)return fail("Card not found or changed; refresh and retry",409);
 if(labelIds!==undefined){await prisma.cardLabel.deleteMany({where:{cardId}});if(labelIds.length)await prisma.cardLabel.createMany({data:labelIds.map(labelId=>({cardId,labelId}))});}
 const card=await prisma.card.findUnique({where:{id:cardId},include:{assignee:{select:{id:true,name:true,email:true}},labels:{include:{label:true}}}});
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
 const deleted=await prisma.card.deleteMany({where:{id:cardId,version:baseVersion,column:{boardId}}});
 if(!deleted.count)return fail("Card not found or changed; refresh and retry",409);
 return Response.json({ok:true});
}
