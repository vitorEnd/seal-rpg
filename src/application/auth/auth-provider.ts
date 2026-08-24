import type { ISODateString, User } from "@/domain/entities";

export interface SignInInput {
  identifier: string;
  password: string;
}

export interface SignUpInput {
  name: string;
  username: string;
  email: string;
  password: string;
}

export interface AuthSession {
  token: string;
  expiresAt: ISODateString;
  user: User;
}

export type AuthErrorCode =
  | "invalid_credentials"
  | "duplicate_username"
  | "duplicate_email"
  | "disabled_user"
  | "email_confirmation_required";

export class AuthError extends Error {
  constructor(
    public readonly code: AuthErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "AuthError";
  }
}

export interface AuthProvider {
  /**
   * Supabase Auth persists and refreshes its own SSR cookies. Local adapters
   * leave this undefined and keep using the application's development cookie.
   */
  readonly managesSessionCookies?: boolean;
  signIn(input: SignInInput): Promise<AuthSession>;
  signUp(input: SignUpInput): Promise<AuthSession>;
  getSession(token: string): Promise<AuthSession | null>;
  getCurrentSession?(): Promise<AuthSession | null>;
  signOut(token: string): Promise<void>;
}
