import { createServerClient } from "@supabase/ssr";
import { type NextRequest, NextResponse } from "next/server";

import type { Database } from "@/infrastructure/supabase/database.types";
import {
  getPublicSupabaseConfig,
  hasPublicSupabaseConfig,
} from "@/lib/supabase/config";

export async function updateSession(request: NextRequest) {
  if (!hasPublicSupabaseConfig()) {
    return NextResponse.next({ request });
  }

  const { url, publishableKey } = getPublicSupabaseConfig();
  let response = NextResponse.next({ request });
  const supabase = createServerClient<Database>(url, publishableKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        for (const { name, value } of cookiesToSet) {
          request.cookies.set(name, value);
        }

        response = NextResponse.next({ request });
        for (const { name, value, options } of cookiesToSet) {
          response.cookies.set(name, value, options);
        }
      },
    },
  });

  // getClaims validates the JWT and refreshes it when required. Do not replace
  // this with getSession: cookie-backed session objects are not authoritative.
  await supabase.auth.getClaims();
  return response;
}
