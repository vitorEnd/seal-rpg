export interface AuthFormState {
  message: string | null;
  fieldErrors: {
    name?: string[];
    username?: string[];
    email?: string[];
    identifier?: string[];
    password?: string[];
    passwordConfirmation?: string[];
  };
}

export const INITIAL_AUTH_FORM_STATE: AuthFormState = {
  message: null,
  fieldErrors: {},
};

