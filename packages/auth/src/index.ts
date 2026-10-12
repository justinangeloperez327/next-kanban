import { createHash, randomBytes } from "node:crypto";
import { SignJWT, jwtVerify } from "jose";
import { prisma } from "@next-kanban/database";

export const SESSION_COOKIE = "nk_session";
const SESSION_DAYS = 14;

export function sessionHash(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export async function createSession(userId: string) {
  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 86400_000);
  await prisma.session.create({
    data: { userId, tokenHash: sessionHash(token), expiresAt },
  });
  return { token, expiresAt };
}

export async function sessionUser(token?: string | null) {
  if (!token) return null;
  const session = await prisma.session.findUnique({
    where: { tokenHash: sessionHash(token) },
    include: { user: true },
  });
  if (!session || session.expiresAt <= new Date()) return null;
  return session.user;
}

export async function revokeSession(token?: string | null) {
  if (token) await prisma.session.deleteMany({ where: { tokenHash: sessionHash(token) } });
}

function signingKey() {
  const secret = process.env.SOCKET_TOKEN_SECRET;
  if (!secret || secret.length < 32) throw new Error("SOCKET_TOKEN_SECRET must be at least 32 characters");
  return new TextEncoder().encode(secret);
}

export async function issueSocketToken(userId: string) {
  return new SignJWT({ scope: "realtime" })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(userId)
    .setIssuedAt()
    .setExpirationTime("5m")
    .setIssuer("next-kanban")
    .setAudience("next-kanban-realtime")
    .sign(signingKey());
}

export async function verifySocketToken(token: string): Promise<string> {
  const { payload } = await jwtVerify(token, signingKey(), {
    algorithms: ["HS256"],
    issuer: "next-kanban",
    audience: "next-kanban-realtime",
  });
  if (payload.scope !== "realtime" || !payload.sub) throw new Error("Invalid realtime token");
  return payload.sub;
}

export async function boardRole(boardId: string, userId: string) {
  const member = await prisma.boardMember.findUnique({
    where: { boardId_userId: { boardId, userId } },
    select: { role: true },
  });
  return member?.role ?? null;
}
