import "server-only";

import { cookies } from "next/headers";

import type { AuthSession } from "@/application/auth/auth-provider";

export const DEV_SESSION_COOKIE = "rpg_vitin_dev_session";

export async function readSessionToken(): Promise<string | null> {
  return (await cookies()).get(DEV_SESSION_COOKIE)?.value ?? null;
}

export async function writeSessionCookie(session: AuthSession): Promise<void> {
  (await cookies()).set(DEV_SESSION_COOKIE, session.token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires: new Date(session.expiresAt),
    priority: "high",
  });
}

export async function deleteSessionCookie(): Promise<void> {
  (await cookies()).delete(DEV_SESSION_COOKIE);
}
