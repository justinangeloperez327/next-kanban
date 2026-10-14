import { prisma } from "@next-kanban/database";
import { currentUser } from "@/lib/auth";
import { boardAccess, canEditBoard } from "@/lib/board-access";
import { fail } from "@/lib/workspaces";
import { z } from "zod";
type Context = { params: Promise<{ boardId: string; cardId: string }> };
const updateInput = z.object({
 title: z.string().trim().min(1).max(200).optional(),
 description: z.string().trim().max(10000).nullable().optional(),
 baseVersion: z.number().int().nonnegative(),
}).refine(data => data.title !== undefined || data.description !== undefined);
export async function GET(_req: Request, { params }: Context) {
 const user = await currentUser(); if (!user) return fail("Unauthorized",401);
 const { boardId, cardId } = await params;
 if (!(await boardAccess(boardId,user.id))) return fail("Not found",404);
 const card = await prisma.card.findFirst({ where:{id:cardId,column:{boardId}}, select:{id:true,title:true,description:true,position:true,columnId:true,version:true,createdAt:true,updatedAt:true} });
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
 const {baseVersion,...fields}=parsed.data;
 const updated=await prisma.card.updateMany({where:{id:cardId,version:baseVersion,column:{boardId}},data:{...fields,version:{increment:1}}});
 if(!updated.count)return fail("Card not found or changed; refresh and retry",409);
 const card=await prisma.card.findUnique({where:{id:cardId}});
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
