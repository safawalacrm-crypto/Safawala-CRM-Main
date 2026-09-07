import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
import { hasSupabaseEnv, supabaseConfig } from './config';
import { accessModuleForPath } from '@/lib/staff-portal/access-modules';

export async function updateSession(request: NextRequest) {
  const path = request.nextUrl.pathname;

  let response = NextResponse.next({ request });
  if (!hasSupabaseEnv()) {
    if (path.startsWith('/dashboard'))
      return NextResponse.redirect(new URL('/login', request.url));
    return response;
  }
  const supabase = createServerClient(supabaseConfig.url, supabaseConfig.key, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) =>
          request.cookies.set(name, value),
        );
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) =>
          response.cookies.set(name, value, options),
        );
      },
    },
  });
  // Staff Portal pages perform the complete role, active-account, department, and
  // module checks in their server-side guards. Avoid repeating those same database
  // reads in middleware on every internal navigation. This cookie-session check is
  // only a routing shortcut; the guarded page still validates the user with getUser()
  // before it can return any protected data.
  if (path.startsWith('/staff-portal') && path !== '/staff-portal/login') {
    const { data: sessionData } = await supabase.auth.getSession();
    return sessionData.session
      ? response
      : NextResponse.redirect(new URL('/staff-portal/login', request.url));
  }

  const { data } = await supabase.auth.getUser();
  const requestedModule = data.user ? accessModuleForPath(path) : null;
  const [profileResult, staffAccountResult, accessResult] = data.user
    ? await Promise.all([
        supabase
          .from('profiles')
          .select('role')
          .eq('id', data.user.id)
          .maybeSingle(),
        supabase
          .from('staff_members')
          .select('portal_active,is_active')
          .eq('user_id', data.user.id)
          .maybeSingle(),
        requestedModule
          ? supabase.rpc('staff_can_access', {
              requested_module: requestedModule,
            })
          : Promise.resolve({ data: false, error: null }),
      ])
    : [{ data: null }, { data: null }, { data: false }];
  const profile = profileResult.data;
  const role = profile?.role ?? 'admin';

  let staffAccountActive = true;
  if (data.user && role === 'staff') {
    const staffAccount = staffAccountResult.data;
    staffAccountActive = Boolean(
      staffAccount?.portal_active && staffAccount.is_active,
    );

    if (!staffAccountActive) {
      await supabase.auth.signOut();
    }
  }

  if (
    data.user &&
    role === 'staff' &&
    staffAccountActive &&
    !path.startsWith('/staff-portal')
  ) {
    if (requestedModule && accessResult.data) return response;
    return NextResponse.redirect(new URL('/staff-portal', request.url));
  }
  if (data.user && role === 'admin' && path.startsWith('/staff-portal')) {
    return NextResponse.redirect(new URL('/dashboard', request.url));
  }
  if (path.startsWith('/staff-portal')) {
    if (
      (!data.user || (role === 'staff' && !staffAccountActive)) &&
      path !== '/staff-portal/login'
    ) {
      return NextResponse.redirect(new URL('/staff-portal/login', request.url));
    }
    if (
      data.user &&
      role === 'staff' &&
      staffAccountActive &&
      path === '/staff-portal/login'
    ) {
      return NextResponse.redirect(new URL('/staff-portal', request.url));
    }
    return response;
  }
  if (!data.user && path.startsWith('/dashboard'))
    return NextResponse.redirect(new URL('/login', request.url));
  if (data.user && path === '/login')
    return NextResponse.redirect(new URL('/dashboard', request.url));
  return response;
}
