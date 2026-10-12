import { NextResponse } from "next/server";
import { issueSocketToken } from "@next-kanban/auth";
import { currentUser } from "@/lib/auth";

export async function POST() {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const token = await issueSocketToken(user.id);
  return NextResponse.json({ token }, { headers: { "Cache-Control": "no-store" } });
}
