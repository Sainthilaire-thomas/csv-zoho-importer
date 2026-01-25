import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

const cookieDomain = process.env.NODE_ENV === 'production' ? '.sonear.com' : undefined;

export const createClient = async () => {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, {
                ...options,
                domain: cookieDomain,
              })
            );
          } catch {
            // Ignore in Server Components
          }
        },
      },
    }
  );
};
