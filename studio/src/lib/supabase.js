import { createBrowserClient, isBrowser, parse } from '@supabase/ssr';
import { PUBLIC_SUPABASE_URL, PUBLIC_SUPABASE_ANON_KEY } from '$env/static/public';

export function createSupabaseClient(fetch) {
  return createBrowserClient(PUBLIC_SUPABASE_URL, PUBLIC_SUPABASE_ANON_KEY, {
    global: { fetch },
    cookies: {
      getAll() {
        if (!isBrowser()) return [];
        return parse(document.cookie);
      },
      setAll(cookiesToSet) {
        if (!isBrowser()) return;
        cookiesToSet.forEach(({ name, value, options }) => {
          document.cookie = `${name}=${value}; path=/; ${options?.maxAge ? `max-age=${options.maxAge};` : ''}`;
        });
      }
    }
  });
}
