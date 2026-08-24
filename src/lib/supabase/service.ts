import "server-only";

import { createClient as createSupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/infrastructure/supabase/database.types";
import { getPublicSupabaseConfig } from "@/lib/supabase/config";

/**
 * Server-only client for narrowly scoped administrative operations such as
 * resolving a username to its private login email and importing legacy data.
 */
export function createServiceClient() {
  const { url } = getPublicSupabaseConfig();
  const secretKey = process.env.SUPABASE_SECRET_KEY;

  if (!secretKey) {
    throw new Error(
      "Configure SUPABASE_SECRET_KEY no servidor para habilitar login por usuário e bootstrap.",
    );
  }

  return createSupabaseClient<Database>(url, secretKey, {
    auth: {
      autoRefreshToken: false,
      detectSessionInUrl: false,
      persistSession: false,
    },
  });
}
