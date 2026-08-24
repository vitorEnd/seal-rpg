import "server-only";

import { cache } from "react";

import type { AuthSession } from "@/application/auth/auth-provider";
import type { User, UserRole } from "@/domain/entities";
import { authProvider } from "@/lib/container";
import { readSessionToken } from "@/lib/auth/session-cookie";

export const getCurrentSession = cache(
  async (): Promise<AuthSession | null> => {
    if (authProvider.getCurrentSession) {
      return authProvider.getCurrentSession();
    }
    const token = await readSessionToken();
    return token ? authProvider.getSession(token) : null;
  },
);

export async function getCurrentUser(): Promise<User | null> {
  return (await getCurrentSession())?.user ?? null;
}

export async function requireUser(): Promise<User> {
  const user = await getCurrentUser();
  if (!user) {
    throw new Error("AUTH_REQUIRED");
  }
  return user;
}

export async function requireRole(roles: readonly UserRole[]): Promise<User> {
  const user = await requireUser();
  if (!roles.includes(user.role)) {
    throw new Error("ACCESS_DENIED");
  }
  return user;
}
