import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { supabaseConfig } from './config';

export async function createClient() {
  const cookieStore = await cookies();
  if (!supabaseConfig.url || !supabaseConfig.key) throw new Error('Supabase public environment variables are not configured.');
  return createServerClient(supabaseConfig.url, supabaseConfig.key, {
    cookies: {
      getAll: () => cookieStore.getAll(),
      setAll(cookiesToSet) {
        try { cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options)); }
        catch { /* Middleware refreshes sessions when Server Components cannot write cookies. */ }
      },
    },
  });
}
