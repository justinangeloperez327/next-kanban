import { NextResponse } from "next/server";
import { hash } from "bcryptjs";
import { prisma } from "@next-kanban/database";
import { createSession, SESSION_COOKIE } from "@next-kanban/auth";
import { z } from "zod";

const schema = z.object({
  name: z.string().trim().min(2).max(100),
  email: z.email().max(254).transform((v) => v.toLowerCase()),
  password: z.string().min(12).max(128),
});
export async function POST(request: Request) {
  const data = schema.safeParse(await request.json().catch(() => null));
  if (!data.success) return NextResponse.json({ error: "Invalid name, email, or password (12+ characters required)." }, { status: 400 });

  const { name, email, password } = data.data;
  const passwordHash = await hash(password, 12);
  let user;
  try {
    user = await prisma.user.create({
      data: {
        name, email, passwordHash,
        workspaceMemberships: { create: { role: "OWNER", workspace: { create: { name: "My Workspace", slug: crypto.randomUUID(), projects: { create: { name: "My first project", slug: crypto.randomUUID() } } } } } },
        memberships: {
          create: {
            role: "OWNER",
            board: {
              create: {
                title: "My first board",
                slug: crypto.randomUUID(),
                columns: {
                  create: [
                    { title: "To do", position: 1000 },
                    { title: "In progress", position: 2000 },
                    { title: "Done", position: 3000 },
                  ],
                },
              },
            },
          },
        },
      },
    });
  } catch (error) {
    if (typeof error === "object" && error !== null && "code" in error && error.code === "P2002") {
      return NextResponse.json({ error: "Unable to register this email." }, { status: 409 });
    }
    throw error;
  }
  // Associate the starter board with the starter project for new accounts.
  const [project, membership] = await Promise.all([
    prisma.project.findFirst({ where: { workspace: { members: { some: { userId: user.id } } } }, select: { id: true } }),
    prisma.boardMember.findFirst({ where: { userId: user.id }, select: { boardId: true } }),
  ]);
  if (project && membership) {
    await prisma.board.update({ where: { id: membership.boardId }, data: { projectId: project.id } });
  }
  const session = await createSession(user.id);
  const response = NextResponse.json({ ok: true });
  response.cookies.set(SESSION_COOKIE, session.token, {
    httpOnly: true, secure: process.env.NODE_ENV === "production",
    sameSite: "lax", path: "/", expires: session.expiresAt,
  });
  return response;
}
