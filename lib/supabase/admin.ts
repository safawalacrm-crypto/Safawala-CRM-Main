import 'server-only';

import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import { supabaseConfig } from './config';

export function createAdminClient() {
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseConfig.url || !serviceRoleKey) {
    throw new Error('Supabase server environment variables are not configured.');
  }

  return createSupabaseClient(supabaseConfig.url, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
