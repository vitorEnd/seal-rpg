import type { ZodError } from "zod";

export interface MutationState {
  status: "idle" | "success" | "error";
  message: string;
  fieldErrors: Record<string, string[]>;
  revision: number;
}

export const initialMutationState: MutationState = {
  status: "idle",
  message: "",
  fieldErrors: {},
  revision: 0,
};

export function mutationError(
  message: string,
  previousState: MutationState,
  fieldErrors: Record<string, string[]> = {},
): MutationState {
  return {
    status: "error",
    message,
    fieldErrors,
    revision: previousState.revision + 1,
  };
}

export function mutationSuccess(
  message: string,
  previousState: MutationState,
): MutationState {
  return {
    status: "success",
    message,
    fieldErrors: {},
    revision: previousState.revision + 1,
  };
}

export function zodFieldErrors(error: ZodError): Record<string, string[]> {
  const errors: Record<string, string[]> = {};
  for (const issue of error.issues) {
    const key = typeof issue.path[0] === "string" ? issue.path[0] : "form";
    errors[key] = [...(errors[key] ?? []), issue.message];
  }
  return errors;
}
