import { prisma } from "@next-kanban/database";
import { currentUser } from "@/lib/auth";
import { workspacePermission, canManage, fail } from "@/lib/workspaces";
import { z } from "zod";
type Ctx={params:Promise<{projectId:string}>};
const input=z.object({title:z.string().trim().min(2).max(120)});
export async function GET(_request:Request,{params}:Ctx) {
 const user=await currentUser();if(!user)return fail("Unauthorized",401);
 const {projectId}=await params;
 const project=await prisma.project.findUnique({where:{id:projectId},select:{workspaceId:true}});
 if(!project || !(await workspacePermission(project.workspaceId,user.id)))return fail("Not found",404);
 const boards=await prisma.board.findMany({where:{projectId,members:{some:{userId:user.id}}},select:{id:true,title:true,createdAt:true},orderBy:{createdAt:"asc"}});
 return Response.json({boards});
}
export async function POST(request:Request,{params}:Ctx) {
 const user=await currentUser();if(!user)return fail("Unauthorized",401);
 const {projectId}=await params;
 const project=await prisma.project.findUnique({where:{id:projectId},select:{workspaceId:true}});
 if(!project)return fail("Not found",404);
 const membership=await workspacePermission(project.workspaceId,user.id);
 if(!membership)return fail("Not found",404);
 if(!canManage(membership.role))return fail("Forbidden",403);
 const parsed=input.safeParse(await request.json().catch(()=>null));if(!parsed.success)return fail("Invalid board title",400);
 const members=await prisma.workspaceMember.findMany({where:{workspaceId:project.workspaceId},select:{userId:true,role:true}});
 const board=await prisma.board.create({data:{
  projectId,title:parsed.data.title,slug:crypto.randomUUID(),
  members:{create:members.map(m=>({userId:m.userId,role:m.userId===user.id?"OWNER" as const:m.role==="ADMIN"?"EDITOR" as const:"VIEWER" as const}))},
  columns:{create:[{title:"To do",position:1000},{title:"In progress",position:2000},{title:"Done",position:3000}]}
 },select:{id:true,title:true}});
 return Response.json({board},{status:201});
}
