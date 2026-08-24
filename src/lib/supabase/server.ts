import "server-only";

import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

import type { Database } from "@/infrastructure/supabase/database.types";
import { getPublicSupabaseConfig } from "@/lib/supabase/config";

/** Creates one cookie-aware Supabase client for the current request. */
export async function createClient() {
  const { url, publishableKey } = getPublicSupabaseConfig();
  const cookieStore = await cookies();

  return createServerClient<Database>(url, publishableKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          for (const { name, value, options } of cookiesToSet) {
            cookieStore.set(name, value, options);
          }
        } catch {
          // Server Components cannot write cookies. The request Proxy refreshes
          // the session and writes the resulting cookies to the response.
        }
      },
    },
  });
}
