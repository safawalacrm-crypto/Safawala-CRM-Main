import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
import { hasSupabaseEnv, supabaseConfig } from './config';
import { accessModuleForPath } from '@/lib/staff-portal/access-modules';

export async function updateSession(request: NextRequest) {
  const path = request.nextUrl.pathname;

  let response = NextResponse.next({ request });
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
  const { data: profile } = data.user
    ? await supabase.from('profiles').select('role').eq('id', data.user.id).maybeSingle()
    : { data: null };
  const role = profile?.role ?? 'admin';

  if (data.user && role === 'staff' && !path.startsWith('/staff-portal')) {
    const module = accessModuleForPath(path);
    if (module) {
      const { data: allowed } = await supabase.rpc('staff_can_access', { requested_module: module });
      if (allowed) return response;
    }
    return NextResponse.redirect(new URL('/staff-portal', request.url));
  }
  if (data.user && role === 'admin' && path.startsWith('/staff-portal')) {
    return NextResponse.redirect(new URL('/dashboard', request.url));
  }
  if (path.startsWith('/staff-portal')) {
    if (!data.user && path !== '/staff-portal/login') return NextResponse.redirect(new URL('/staff-portal/login', request.url));
    if (data.user && path === '/staff-portal/login') return NextResponse.redirect(new URL('/staff-portal', request.url));
    return response;
  }
  if (!data.user && path.startsWith('/dashboard')) return NextResponse.redirect(new URL('/login', request.url));
  if (data.user && path === '/login') return NextResponse.redirect(new URL('/dashboard', request.url));
  return response;
}
