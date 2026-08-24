import { createBrowserClient } from "@supabase/ssr";

import type { Database } from "@/infrastructure/supabase/database.types";
import { getPublicSupabaseConfig } from "@/lib/supabase/config";

export function createClient() {
  const { url, publishableKey } = getPublicSupabaseConfig();
  return createBrowserClient<Database>(url, publishableKey);
}
