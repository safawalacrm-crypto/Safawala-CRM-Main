import { createBrowserClient } from '@supabase/ssr';
import type { SupabaseClient } from '@supabase/supabase-js';
import { supabaseConfig } from './config';

let browserClient: SupabaseClient | undefined;

export function createClient() {
  if (!supabaseConfig.url || !supabaseConfig.key)
    throw new Error(
      'Supabase public environment variables are not configured.',
    );
  browserClient ??= createBrowserClient(supabaseConfig.url, supabaseConfig.key);
  return browserClient;
}
