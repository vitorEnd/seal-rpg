import "server-only";

import {
  createClient as createSupabaseClient,
  type SupabaseClient,
} from "@supabase/supabase-js";

import {
  AuthError,
  type AuthProvider,
  type AuthSession,
  type SignInInput,
  type SignUpInput,
} from "@/application/auth/auth-provider";
import type { User, UserRole, UserStatus } from "@/domain/entities";
import type { Database } from "@/infrastructure/supabase/database.types";
import { getPublicSupabaseConfig } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";

type ProfileRow = Database["public"]["Tables"]["profiles"]["Row"];

function normalize(value: string): string {
  return value.trim().toLocaleLowerCase("pt-BR");
}

function asUserRole(value: string): UserRole {
  if (value === "admin" || value === "game_master" || value === "player") {
    return value;
  }
  throw new Error("Perfil Supabase contém um papel inválido.");
}

function asUserStatus(value: string): UserStatus {
  if (value === "active" || value === "disabled") return value;
  throw new Error("Perfil Supabase contém um status inválido.");
}

function toUser(profile: ProfileRow): User {
  return {
    id: profile.id,
    name: profile.name,
    username: profile.username,
    email: profile.email,
    avatarUrl: profile.avatar_url,
    role: asUserRole(profile.role),
    status: asUserStatus(profile.status),
    createdAt: profile.created_at,
    updatedAt: profile.updated_at,
  };
}

function toSession(
  profile: ProfileRow,
  token: string,
  expiresAtSeconds: number | undefined,
): AuthSession {
  const expiresAt = new Date(
    (expiresAtSeconds ?? Math.floor(Date.now() / 1000) + 3600) * 1000,
  ).toISOString();
  return { token, expiresAt, user: toUser(profile) };
}

async function loadCurrentProfile(
  client: SupabaseClient<Database>,
): Promise<ProfileRow | null> {
  const { data, error } = await client.rpc("get_current_profile");
  if (error) throw error;
  return data ?? null;
}

async function resolveUsername(identifier: string): Promise<ProfileRow | null> {
  if (!/^[a-z0-9_]{3,24}$/.test(identifier)) return null;
  const service = createServiceClient();
  const { data, error } = await service
    .from("profiles")
    .select("*")
    .eq("username", identifier)
    .maybeSingle();
  if (error) throw error;
  return data;
}

async function ensureRegistrationIsAvailable(
  username: string,
  email: string,
): Promise<void> {
  const service = createServiceClient();
  const [usernameResult, emailResult] = await Promise.all([
    service.from("profiles").select("id").eq("username", username).maybeSingle(),
    service.from("profiles").select("id").eq("email", email).maybeSingle(),
  ]);

  if (usernameResult.error) throw usernameResult.error;
  if (emailResult.error) throw emailResult.error;
  if (usernameResult.data) {
    throw new AuthError(
      "duplicate_username",
      "Este nome de usuário já está em uso.",
    );
  }
  if (emailResult.data) {
    throw new AuthError("duplicate_email", "Este e-mail já está em uso.");
  }
}

function invalidCredentials(): AuthError {
  return new AuthError(
    "invalid_credentials",
    "Usuário ou senha inválidos.",
  );
}

export class SupabaseAuthProvider implements AuthProvider {
  readonly managesSessionCookies = true;

  async signIn(input: SignInInput): Promise<AuthSession> {
    const identifier = normalize(input.identifier);
    let email = identifier;

    if (!identifier.includes("@")) {
      const profile = await resolveUsername(identifier);
      if (!profile) throw invalidCredentials();
      if (profile.status !== "active") {
        throw new AuthError("disabled_user", "Este usuário está desativado.");
      }
      email = profile.email;
    }

    const client = await createClient();
    const { data, error } = await client.auth.signInWithPassword({
      email,
      password: input.password,
    });
    if (error || !data.session) throw invalidCredentials();

    const profile = await loadCurrentProfile(client);
    if (!profile || profile.status !== "active") {
      await client.auth.signOut({ scope: "local" });
      throw new AuthError("disabled_user", "Este usuário está desativado.");
    }

    return toSession(
      profile,
      data.session.access_token,
      data.session.expires_at,
    );
  }

  async signUp(input: SignUpInput): Promise<AuthSession> {
    const username = normalize(input.username);
    const email = normalize(input.email);
    await ensureRegistrationIsAvailable(username, email);

    const client = await createClient();
    const { data, error } = await client.auth.signUp({
      email,
      password: input.password,
      options: {
        data: {
          name: input.name.trim(),
          username,
        },
      },
    });

    if (error) {
      if (error.code === "user_already_exists") {
        throw new AuthError("duplicate_email", "Este e-mail já está em uso.");
      }
      throw error;
    }

    if (!data.session) {
      throw new AuthError(
        "email_confirmation_required",
        "Conta criada. Confirme o e-mail recebido antes de entrar.",
      );
    }

    const profile = await loadCurrentProfile(client);
    if (!profile) {
      await client.auth.signOut({ scope: "local" });
      throw new Error("O perfil do novo usuário não foi criado pelo Supabase.");
    }

    return toSession(
      profile,
      data.session.access_token,
      data.session.expires_at,
    );
  }

  async getCurrentSession(): Promise<AuthSession | null> {
    const client = await createClient();
    const { data, error } = await client.auth.getClaims();
    const subject = data?.claims.sub;
    if (error || typeof subject !== "string") return null;

    const profile = await loadCurrentProfile(client);
    if (!profile || profile.id !== subject || profile.status !== "active") {
      return null;
    }

    return toSession(
      profile,
      "",
      typeof data.claims.exp === "number" ? data.claims.exp : undefined,
    );
  }

  async getSession(token: string): Promise<AuthSession | null> {
    if (!token) return null;
    const { url, publishableKey } = getPublicSupabaseConfig();
    const client = createSupabaseClient<Database>(url, publishableKey, {
      auth: {
        autoRefreshToken: false,
        detectSessionInUrl: false,
        persistSession: false,
      },
      global: { headers: { Authorization: `Bearer ${token}` } },
    });
    const { data, error } = await client.auth.getClaims(token);
    const subject = data?.claims.sub;
    if (error || typeof subject !== "string") return null;

    const profile = await loadCurrentProfile(client);
    if (!profile || profile.id !== subject || profile.status !== "active") {
      return null;
    }
    return toSession(
      profile,
      token,
      typeof data.claims.exp === "number" ? data.claims.exp : undefined,
    );
  }

  async signOut(_token: string): Promise<void> {
    const client = await createClient();
    const { error } = await client.auth.signOut({ scope: "local" });
    if (error && error.code !== "session_not_found") throw error;
  }
}
