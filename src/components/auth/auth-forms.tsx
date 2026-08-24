"use client";

import Link from "next/link";
import { useActionState } from "react";

import { INITIAL_AUTH_FORM_STATE } from "@/application/auth/auth-form-state";
import { loginAction, registerAction } from "@/app/(auth)/actions";

const inputClassName = "auth-input";

function FieldError({ id, messages }: { id: string; messages?: string[] }) {
  if (!messages?.length) {
    return null;
  }
  return (
    <p id={id} className="auth-field-error" role="alert">
      {messages[0]}
    </p>
  );
}

export function LoginForm({ returnTo }: { returnTo?: string }) {
  const [state, action, pending] = useActionState(
    loginAction,
    INITIAL_AUTH_FORM_STATE,
  );

  return (
    <form action={action} className="auth-form">
      {returnTo ? <input type="hidden" name="next" value={returnTo} /> : null}
      <div className="auth-field">
        <label htmlFor="identifier">
          Usuário ou e-mail
        </label>
        <input
          id="identifier"
          name="identifier"
          autoComplete="username"
          className={inputClassName}
          placeholder="admin"
          aria-invalid={Boolean(state.fieldErrors.identifier?.length)}
          aria-describedby={state.fieldErrors.identifier?.length ? "identifier-error" : undefined}
          required
        />
        <FieldError id="identifier-error" messages={state.fieldErrors.identifier} />
      </div>
      <div className="auth-field">
        <label htmlFor="password">
          Senha
        </label>
        <input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          className={inputClassName}
          placeholder="••••••••"
          aria-invalid={Boolean(state.fieldErrors.password?.length)}
          aria-describedby={state.fieldErrors.password?.length ? "password-error" : undefined}
          required
        />
        <FieldError id="password-error" messages={state.fieldErrors.password} />
      </div>

      {state.message ? (
        <p
          className="auth-form-alert"
          aria-live="polite"
        >
          {state.message}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={pending}
        className="auth-submit"
      >
        {pending ? "Validando…" : "Entrar na central"}
      </button>
      <p className="auth-form-footer">
        Ainda não tem um usuário local?{" "}
        <Link href="/register">
          Criar conta de jogador
        </Link>
      </p>
    </form>
  );
}

export function RegisterForm() {
  const [state, action, pending] = useActionState(
    registerAction,
    INITIAL_AUTH_FORM_STATE,
  );

  return (
    <form action={action} className="auth-form compact">
      <div className="auth-field">
        <label htmlFor="name">
          Nome
        </label>
        <input id="name" name="name" className={inputClassName} aria-invalid={Boolean(state.fieldErrors.name?.length)} aria-describedby={state.fieldErrors.name?.length ? "name-error" : undefined} required />
        <FieldError id="name-error" messages={state.fieldErrors.name} />
      </div>
      <div className="auth-field">
        <label htmlFor="username">
          Usuário
        </label>
        <input
          id="username"
          name="username"
          autoComplete="username"
          className={inputClassName}
          aria-invalid={Boolean(state.fieldErrors.username?.length)}
          aria-describedby={state.fieldErrors.username?.length ? "username-error" : undefined}
          required
        />
        <FieldError id="username-error" messages={state.fieldErrors.username} />
      </div>
      <div className="auth-field">
        <label htmlFor="email">
          E-mail
        </label>
        <input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          className={inputClassName}
          aria-invalid={Boolean(state.fieldErrors.email?.length)}
          aria-describedby={state.fieldErrors.email?.length ? "email-error" : undefined}
          required
        />
        <FieldError id="email-error" messages={state.fieldErrors.email} />
      </div>
      <div className="auth-form-columns">
        <div className="auth-field">
          <label htmlFor="register-password">
            Senha
          </label>
          <input
            id="register-password"
            name="password"
            type="password"
            autoComplete="new-password"
            className={inputClassName}
            aria-invalid={Boolean(state.fieldErrors.password?.length)}
            aria-describedby={state.fieldErrors.password?.length ? "register-password-error" : undefined}
            required
          />
          <FieldError id="register-password-error" messages={state.fieldErrors.password} />
        </div>
        <div className="auth-field">
          <label
            htmlFor="passwordConfirmation"
          >
            Repetir senha
          </label>
          <input
            id="passwordConfirmation"
            name="passwordConfirmation"
            type="password"
            autoComplete="new-password"
            className={inputClassName}
            aria-invalid={Boolean(state.fieldErrors.passwordConfirmation?.length)}
            aria-describedby={state.fieldErrors.passwordConfirmation?.length ? "password-confirmation-error" : undefined}
            required
          />
          <FieldError id="password-confirmation-error" messages={state.fieldErrors.passwordConfirmation} />
        </div>
      </div>

      {state.message ? (
        <p
          className="auth-form-alert"
          aria-live="polite"
        >
          {state.message}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={pending}
        className="auth-submit"
      >
        {pending ? "Criando…" : "Criar usuário local"}
      </button>
      <p className="auth-form-footer">
        O cadastro sempre cria um perfil <strong>player</strong>.{" "}
        <Link href="/login">
          Voltar ao login
        </Link>
      </p>
    </form>
  );
}
