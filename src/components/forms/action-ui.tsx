"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { useFormStatus } from "react-dom";

import {
  initialMutationState,
  type MutationState,
} from "@/application/forms/mutation-state";

export type MutationAction = (
  previousState: MutationState,
  formData: FormData,
) => Promise<MutationState>;

export function SubmitButton({
  children,
  pendingLabel = "Salvando...",
  className = "admin-primary-button",
}: {
  children: React.ReactNode;
  pendingLabel?: string;
  className?: string;
}) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className={className}>
      {pending ? pendingLabel : children}
    </button>
  );
}

export function ActionFeedback({ state }: { state: MutationState }) {
  if (state.status === "idle") return null;
  return (
    <p
      className={state.status === "success" ? "form-feedback success" : "form-feedback error"}
      role={state.status === "error" ? "alert" : "status"}
      aria-live="polite"
    >
      {state.message}
    </p>
  );
}

export function FieldError({
  state,
  name,
}: {
  state: MutationState;
  name: string;
}) {
  const error = state.fieldErrors[name]?.[0];
  return error ? (
    <span className="field-error" role="alert">
      {error}
    </span>
  ) : null;
}

export function ConfirmDeleteForm({
  action,
  id,
  label = "Excluir",
  description = "Esta ação não pode ser desfeita.",
  hiddenFields = {},
}: {
  action: MutationAction;
  id: string;
  label?: string;
  description?: string;
  hiddenFields?: Record<string, string>;
}) {
  const [confirming, setConfirming] = useState(false);
  const [state, formAction, pending] = useActionState(
    action,
    initialMutationState,
  );
  const triggerRef = useRef<HTMLButtonElement>(null);
  const confirmRef = useRef<HTMLButtonElement>(null);
  const wasConfirming = useRef(false);

  useEffect(() => {
    if (confirming) confirmRef.current?.focus();
    else if (wasConfirming.current) triggerRef.current?.focus();
    wasConfirming.current = confirming;
  }, [confirming]);

  if (!confirming) {
    return (
      <div className="space-y-2">
        <button
          ref={triggerRef}
          type="button"
          className="admin-danger-link"
          onClick={() => setConfirming(true)}
        >
          {label}
        </button>
        <ActionFeedback state={state} />
      </div>
    );
  }

  return (
    <div className="delete-confirmation" role="group" aria-live="polite">
      <input type="hidden" name="id" value={id} />
      {Object.entries(hiddenFields).map(([name, value]) => (
        <input key={name} type="hidden" name={name} value={value} />
      ))}
      <p>{description}</p>
      <div className="flex flex-wrap gap-2">
        <button
          ref={confirmRef}
          type="submit"
          formAction={formAction}
          disabled={pending}
          className="admin-danger-button"
        >
          {pending ? "Excluindo..." : "Confirmar exclusão"}
        </button>
        <button
          type="button"
          className="admin-secondary-button"
          onClick={() => setConfirming(false)}
        >
          Cancelar
        </button>
      </div>
      <ActionFeedback state={state} />
    </div>
  );
}
