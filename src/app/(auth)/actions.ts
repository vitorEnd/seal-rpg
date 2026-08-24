"use server";

import { redirect } from "next/navigation";
import { z } from "zod";

import { AuthError } from "@/application/auth/auth-provider";
import type { AuthFormState } from "@/application/auth/auth-form-state";
import { safeReturnTo } from "@/application/auth/safe-return-to";
import { authProvider } from "@/lib/container";
import {
  deleteSessionCookie,
  readSessionToken,
  writeSessionCookie,
} from "@/lib/auth/session-cookie";

const loginSchema = z.object({
  identifier: z.string().trim().min(2, "Informe seu usuário ou e-mail."),
  password: z.string().min(1, "Informe sua senha."),
  next: z.string().optional(),
});

const registerSchema = z
  .object({
    name: z.string().trim().min(2, "Informe um nome com pelo menos 2 caracteres."),
    username: z
      .string()
      .trim()
      .min(3, "Use pelo menos 3 caracteres.")
      .max(24, "Use no máximo 24 caracteres.")
      .regex(
        /^[a-zA-Z0-9_]+$/,
        "Use apenas letras, números e sublinhado.",
      ),
    email: z.email("Informe um e-mail válido."),
    password: z.string().min(8, "Use pelo menos 8 caracteres."),
    passwordConfirmation: z.string(),
  })
  .refine((data) => data.password === data.passwordConfirmation, {
    path: ["passwordConfirmation"],
    message: "As senhas não coincidem.",
  });

function validationState(error: z.ZodError): AuthFormState {
  const fieldErrors: AuthFormState["fieldErrors"] = {};
  const supportedFields = new Set<keyof AuthFormState["fieldErrors"]>([
    "name",
    "username",
    "email",
    "identifier",
    "password",
    "passwordConfirmation",
  ]);

  for (const issue of error.issues) {
    const field = issue.path[0];
    if (
      typeof field !== "string" ||
      !supportedFields.has(field as keyof AuthFormState["fieldErrors"])
    ) {
      continue;
    }

    const supportedField = field as keyof AuthFormState["fieldErrors"];
    fieldErrors[supportedField] = [
      ...(fieldErrors[supportedField] ?? []),
      issue.message,
    ];
  }

  return { message: "Revise os campos destacados.", fieldErrors };
}

export async function loginAction(
  previousState: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  void previousState;
  const parsed = loginSchema.safeParse({
    identifier: formData.get("identifier"),
    password: formData.get("password"),
    next: formData.get("next") || undefined,
  });

  if (!parsed.success) {
    return validationState(parsed.error);
  }

  let session;
  try {
    session = await authProvider.signIn(parsed.data);
  } catch (error) {
    if (error instanceof AuthError) {
      return { message: error.message, fieldErrors: {} };
    }
    throw error;
  }

  if (!authProvider.managesSessionCookies) {
    await writeSessionCookie(session);
  }
  const destination =
    safeReturnTo(parsed.data.next) ??
    (session.user.role === "admin" ? "/admin" : "/campaigns");
  redirect(destination);
}

export async function registerAction(
  previousState: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  void previousState;
  const parsed = registerSchema.safeParse({
    name: formData.get("name"),
    username: formData.get("username"),
    email: formData.get("email"),
    password: formData.get("password"),
    passwordConfirmation: formData.get("passwordConfirmation"),
  });

  if (!parsed.success) {
    return validationState(parsed.error);
  }

  let session;
  try {
    session = await authProvider.signUp({
      name: parsed.data.name,
      username: parsed.data.username,
      email: parsed.data.email,
      password: parsed.data.password,
    });
  } catch (error) {
    if (error instanceof AuthError) {
      const field =
        error.code === "duplicate_username"
          ? "username"
          : error.code === "duplicate_email"
            ? "email"
            : undefined;
      return {
        message: error.message,
        fieldErrors: field ? { [field]: [error.message] } : {},
      };
    }
    throw error;
  }

  if (!authProvider.managesSessionCookies) {
    await writeSessionCookie(session);
  }
  redirect("/campaigns");
}

export async function logoutAction(): Promise<never> {
  if (authProvider.managesSessionCookies) {
    await authProvider.signOut("");
  } else {
    const token = await readSessionToken();
    if (token) {
      await authProvider.signOut(token);
    }
  }
  // Also clears a development cookie left by an earlier local session.
  await deleteSessionCookie();
  redirect("/login");
}
