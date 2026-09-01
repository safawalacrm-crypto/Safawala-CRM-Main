import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
import { hasSupabaseEnv, supabaseConfig } from './config';

export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });
  const path = request.nextUrl.pathname;
  if (!hasSupabaseEnv()) {
    if (path.startsWith('/dashboard')) return NextResponse.redirect(new URL('/login', request.url));
    return response;
  }
  const supabase = createServerClient(supabaseConfig.url, supabaseConfig.key, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
      },
    },
  });
  const { data } = await supabase.auth.getUser();
  if (!data.user && path.startsWith('/dashboard')) return NextResponse.redirect(new URL('/login', request.url));
  if (data.user && path === '/login') return NextResponse.redirect(new URL('/dashboard', request.url));
  return response;
}
