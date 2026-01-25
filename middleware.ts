import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          supabaseResponse = NextResponse.next({
            request,
          });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const authUrl = process.env.NEXT_PUBLIC_AUTH_URL || 'https://auth-central-six.vercel.app';
  const appSlug = 'csv-importer';
  const currentUrl = request.nextUrl.toString();

  // Routes publiques (pas de protection)
  const publicRoutes = ['/unauthorized', '/api/'];
  const isPublicRoute = publicRoutes.some((route) =>
    request.nextUrl.pathname.startsWith(route)
  );

  if (isPublicRoute) {
    return supabaseResponse;
  }

  // Si pas connecté, rediriger vers Auth Central
  if (!user) {
    const loginUrl = `${authUrl}/login?app=${appSlug}&redirect=${encodeURIComponent(currentUrl)}`;
    return NextResponse.redirect(loginUrl);
  }

  // Vérifier l'accès à l'application dans user_app_access
  const { data: access } = await supabase
    .from('user_app_access')
    .select('id, role')
    .eq('user_id', user.id)
    .eq('app_slug', appSlug)
    .single();

  // Si pas d'accès, rediriger vers la page unauthorized
  if (!access) {
    const url = request.nextUrl.clone();
    url.pathname = '/unauthorized';
    return NextResponse.redirect(url);
  }

  // Tout est OK, continuer
  return supabaseResponse;
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
