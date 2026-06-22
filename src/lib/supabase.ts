/**
 * Database client entry point.
 *
 * Two backends share the same exported name `supabase`:
 *
 *   - **Tauri desktop runtime** (window.__TAURI_INTERNALS__ present):
 *     `supabase` is the local SQLite adapter from `./db`. It implements
 *     the same `.from(table).select().eq()...` chainable API and the
 *     `auth` / `rpc` namespaces, so existing React components are not
 *     touched.
 *
 *   - **Plain browser** (regular Vite dev server, Vercel preview, etc.):
 *     `supabase` is the real `@supabase/supabase-js` client built from
 *     the `VITE_SUPABASE_*` env vars. This preserves the original cloud
 *     flow for development and the web build.
 *
 * The switch happens once at module load. Every consumer of
 * `import { supabase } from '@/lib/supabase'` automatically gets the
 * right backend without changing a single line.
 */

import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { isTauri } from './db/runtime';
import { localDbClient, type LocalDbClient } from './db';

// Anything assignable to both the real client and the local adapter for
// the methods we actually use. We declare it as the loose union and let
// existing call-sites keep working.
export type DbClient = SupabaseClient | LocalDbClient;

function createCloudClient(): SupabaseClient {
  const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string | undefined;
  const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    throw new Error(
      'Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY environment variables. ' +
        'Set them in `.env`, or run the app inside Tauri to use the local SQLite backend.',
    );
  }
  return createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
}

/**
 * The exported client. Cast to `any` at the type-level so existing
 * call-sites that typed their results against the real Supabase shape
 * keep compiling — the runtime values match because the adapter
 * deliberately replicates the same response envelope.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const supabase: any = isTauri() ? localDbClient : createCloudClient();

/** Boolean flag for places that want to render different UI per backend. */
export const isLocalBackend = isTauri();
