import "server-only";

import { createHash, randomBytes, randomUUID } from "node:crypto";

import {
  AuthError,
  type AuthProvider,
  type AuthSession,
  type SignInInput,
  type SignUpInput,
} from "@/application/auth/auth-provider";
import type { User } from "@/domain/entities";
import { JsonDatabase } from "@/infrastructure/local/json-database";
import {
  hashPassword,
  verifyPassword,
} from "@/infrastructure/local/password";

const SESSION_DURATION_MS = 7 * 24 * 60 * 60 * 1000;

function normalize(value: string): string {
  return value.trim().toLocaleLowerCase("pt-BR");
}

function hashSessionToken(token: string): string {
  return createHash("sha256").update(token).digest("base64url");
}

function newSession(user: User): AuthSession {
  return {
    token: randomBytes(32).toString("base64url"),
    expiresAt: new Date(Date.now() + SESSION_DURATION_MS).toISOString(),
    user: structuredClone(user),
  };
}

export class LocalAuthProvider implements AuthProvider {
  constructor(private readonly database: JsonDatabase) {}

  async signIn(input: SignInInput): Promise<AuthSession> {
    const identifier = normalize(input.identifier);

    return this.database.mutate(async (database) => {
      const user = database.users.find(
        (candidate) =>
          normalize(candidate.username) === identifier ||
          normalize(candidate.email) === identifier,
      );

      if (!user) {
        throw new AuthError(
          "invalid_credentials",
          "Usuário ou senha inválidos.",
        );
      }

      if (user.status !== "active") {
        throw new AuthError("disabled_user", "Este usuário está desativado.");
      }

      const credential = database.authCredentials.find(
        (candidate) => candidate.userId === user.id,
      );
      const isValid =
        credential &&
        (await verifyPassword(input.password, credential.passwordHash));

      if (!isValid) {
        throw new AuthError(
          "invalid_credentials",
          "Usuário ou senha inválidos.",
        );
      }

      const session = newSession(user);
      const now = new Date().toISOString();
      database.authSessions = database.authSessions.filter(
        (candidate) => candidate.expiresAt > now,
      );
      database.authSessions.push({
        id: randomUUID(),
        userId: user.id,
        tokenHash: hashSessionToken(session.token),
        createdAt: now,
        expiresAt: session.expiresAt,
      });

      return session;
    });
  }

  async signUp(input: SignUpInput): Promise<AuthSession> {
    const username = normalize(input.username);
    const email = normalize(input.email);
    const passwordHash = await hashPassword(input.password);

    return this.database.mutate((database) => {
      if (
        database.users.some(
          (candidate) => normalize(candidate.username) === username,
        )
      ) {
        throw new AuthError(
          "duplicate_username",
          "Este nome de usuário já está em uso.",
        );
      }

      if (
        database.users.some(
          (candidate) => normalize(candidate.email) === email,
        )
      ) {
        throw new AuthError(
          "duplicate_email",
          "Este e-mail já está em uso.",
        );
      }

      const now = new Date().toISOString();
      const user: User = {
        id: randomUUID(),
        name: input.name.trim(),
        username,
        email,
        avatarUrl: null,
        role: "player",
        status: "active",
        createdAt: now,
        updatedAt: now,
      };
      const session = newSession(user);

      database.users.push(user);
      database.authCredentials.push({
        userId: user.id,
        passwordHash,
        createdAt: now,
        updatedAt: now,
      });
      database.authSessions.push({
        id: randomUUID(),
        userId: user.id,
        tokenHash: hashSessionToken(session.token),
        createdAt: now,
        expiresAt: session.expiresAt,
      });

      return session;
    });
  }

  async getSession(token: string): Promise<AuthSession | null> {
    if (!token) {
      return null;
    }

    const tokenHash = hashSessionToken(token);
    const database = await this.database.read();
    const storedSession = database.authSessions.find(
      (candidate) => candidate.tokenHash === tokenHash,
    );

    if (!storedSession) {
      return null;
    }

    if (storedSession.expiresAt <= new Date().toISOString()) {
      await this.signOut(token);
      return null;
    }

    const user = database.users.find(
      (candidate) => candidate.id === storedSession.userId,
    );

    if (!user || user.status !== "active") {
      return null;
    }

    return {
      token,
      expiresAt: storedSession.expiresAt,
      user: structuredClone(user),
    };
  }

  async signOut(token: string): Promise<void> {
    const tokenHash = hashSessionToken(token);
    await this.database.mutate((database) => {
      database.authSessions = database.authSessions.filter(
        (candidate) => candidate.tokenHash !== tokenHash,
      );
    });
  }
}

