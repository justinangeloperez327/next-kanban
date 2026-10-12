import { cookies } from "next/headers";
import { SESSION_COOKIE, sessionUser } from "@next-kanban/auth";

export async function currentUser() {
  const store = await cookies();
  return sessionUser(store.get(SESSION_COOKIE)?.value);
}
