/**
 * Local-first database adapter — drop-in replacement for the
 * `@supabase/supabase-js` client.
 *
 *   import { supabase } from '@/lib/supabase'
 *
 * still works exactly as before:
 *
 *   const { data, error } = await supabase
 *     .from('factures')
 *     .select('*, client:clients(*)')
 *     .eq('user_id', user.id)
 *     .order('date_emission', { ascending: false })
 *     .limit(5)
 *
 * Internally, when running inside Tauri, every chain is translated into
 * parameterised SQL and executed against the embedded SQLite database via
 * the Rust `execute_query` / `fetch_rows` IPC commands implemented in
 * Task 2.
 *
 * The `supabase.auth` namespace is handled by `localAuth` (see ./auth.ts).
 * The `supabase.rpc('execute_sql', …)` call used by the SQL editor and
 * DB-management pages is routed straight to `execute_query`.
 *
 * The shape of every returned value matches `PostgrestResponse` so React
 * components don't need to know which backend served them.
 */

import { QueryBuilder, type AdapterResponse } from './query';
import { executeQuery, fetchRows } from './runtime';
import { localAuth } from './auth';

// ---------------------------------------------------------------------------
// Public adapter
// ---------------------------------------------------------------------------

/**
 * Shape returned by `localDbClient.channel(...)`. Mirrors the subset of
 * `RealtimeChannel` actually consumed by the codebase (`.on().subscribe()`,
 * `.unsubscribe()`). The local backend has no realtime stream, so all
 * methods are safe no-ops — the chain just terminates without ever
 * delivering a payload.
 */
export interface LocalRealtimeChannel {
  topic: string;
  on(...args: unknown[]): LocalRealtimeChannel;
  subscribe(callback?: (status: string) => void): LocalRealtimeChannel;
  unsubscribe(): Promise<'ok'>;
}

export interface LocalDbClient {
  from(table: string): QueryBuilder;
  rpc(
    fn: string,
    params?: Record<string, unknown>,
  ): Promise<AdapterResponse<unknown>>;
  auth: typeof localAuth;
  /** Realtime no-op: returns a chainable channel that never emits. */
  channel(topic: string): LocalRealtimeChannel;
  removeChannel(channel: LocalRealtimeChannel): Promise<'ok'>;
  removeAllChannels(): Promise<'ok'>;
  getChannels(): LocalRealtimeChannel[];
  /** No-op storage placeholder — image uploads go through Tauri FS later. */
  storage: {
    from(bucket: string): {
      upload: (...args: unknown[]) => Promise<AdapterResponse<unknown>>;
      download: (...args: unknown[]) => Promise<AdapterResponse<unknown>>;
      remove: (...args: unknown[]) => Promise<AdapterResponse<unknown>>;
      getPublicUrl: (path: string) => { data: { publicUrl: string } };
      list: (...args: unknown[]) => Promise<AdapterResponse<unknown>>;
    };
  };
}

// ---------------------------------------------------------------------------
// Realtime no-op factory.
//
// The cloud Supabase client exposes a Realtime channel API so React
// components can subscribe to row-level changes pushed from the server.
// In the local-first build there is no remote process to push events,
// so we provide a benign stub: the channel object is chainable like
// the real one (so existing call-sites such as
//
//   supabase.channel('foo').on('postgres_changes', ..., cb).subscribe()
//
// keep their fluent shape), but no callback is ever invoked. Components
// that rely on realtime updates will simply not refresh automatically;
// they all already have a polling fallback or are re-fetched manually
// on user interaction, so behaviour is preserved with zero changes to
// any component.
//
// The channels registry is tracked globally so `removeAllChannels()`
// and `getChannels()` behave faithfully if a future audit needs them.
// ---------------------------------------------------------------------------

const channelRegistry = new Set<LocalRealtimeChannel>();

function makeLocalChannel(topic: string): LocalRealtimeChannel {
  const channel: LocalRealtimeChannel = {
    topic,
    on() {
      return channel;
    },
    subscribe(callback) {
      // Mirror Supabase v2: the subscribe callback receives a status
      // string. We fire 'SUBSCRIBED' on the next tick so any code that
      // awaits the handshake stays unblocked.
      if (typeof callback === 'function') {
        setTimeout(() => {
          try {
            callback('SUBSCRIBED');
          } catch {
            /* swallow — same defensive policy as auth listeners */
          }
        }, 0);
      }
      return channel;
    },
    async unsubscribe() {
      channelRegistry.delete(channel);
      return 'ok';
    },
  };
  return channel;
}

const unsupportedStorage = (): Promise<AdapterResponse<unknown>> =>
  Promise.resolve({
    data: null,
    error: {
      message:
        'storage.* is not implemented yet in the local-first adapter; use the Tauri FS APIs.',
      code: 'STORAGE_NOT_LOCAL',
    },
    count: null,
    status: 501,
    statusText: 'Not Implemented',
  });

export const localDbClient: LocalDbClient = {
  from(table: string) {
    return new QueryBuilder(table);
  },

  /**
   * RPC bridge.
   *
   * The codebase uses one RPC: `execute_sql({ sql })` (Database Manager,
   * SQL editor). We route it to the same `execute_query` IPC the rest of
   * the adapter relies on, then return PostgREST-shaped data.
   */
  async rpc(
    fn: string,
    params?: Record<string, unknown>,
  ): Promise<AdapterResponse<unknown>> {
    if (fn !== 'execute_sql') {
      return {
        data: null,
        error: { message: `RPC "${fn}" is not available in local-first mode` },
        count: null,
        status: 501,
        statusText: 'Not Implemented',
      };
    }
    const sql = String(params?.sql ?? '').trim();
    if (!sql) {
      return {
        data: null,
        error: { message: 'execute_sql requires a non-empty `sql` parameter' },
        count: null,
        status: 400,
        statusText: 'Bad Request',
      };
    }
    try {
      // Heuristic: if the statement is a SELECT/PRAGMA/EXPLAIN, return rows;
      // otherwise just execute and report rowsAffected.
      const head = sql.replace(/^\s*\(*\s*/, '').slice(0, 8).toUpperCase();
      if (head.startsWith('SELECT') || head.startsWith('PRAGMA') || head.startsWith('EXPLAIN') || head.startsWith('WITH')) {
        const rows = await fetchRows(sql);
        return { data: rows, error: null, count: null, status: 200, statusText: 'OK' };
      }
      const res = await executeQuery(sql);
      return {
        data: res,
        error: null,
        count: res.rowsAffected,
        status: 200,
        statusText: 'OK',
      };
    } catch (err) {
      return {
        data: null,
        error: { message: err instanceof Error ? err.message : String(err) },
        count: null,
        status: 500,
        statusText: 'Internal',
      };
    }
  },

  auth: localAuth,

  // ----- realtime stubs ----------------------------------------------
  // See the long-form comment above `makeLocalChannel` for rationale.
  channel(topic: string) {
    const ch = makeLocalChannel(topic);
    channelRegistry.add(ch);
    return ch;
  },

  async removeChannel(channel: LocalRealtimeChannel) {
    channelRegistry.delete(channel);
    return 'ok';
  },

  async removeAllChannels() {
    channelRegistry.clear();
    return 'ok';
  },

  getChannels() {
    return Array.from(channelRegistry);
  },

  storage: {
    from(_bucket: string) {
      return {
        upload: unsupportedStorage,
        download: unsupportedStorage,
        remove: unsupportedStorage,
        getPublicUrl: (path: string) => ({ data: { publicUrl: path } }),
        list: unsupportedStorage,
      };
    },
  },
};

export { QueryBuilder } from './query';
export type { AdapterResponse } from './query';
export { isTauri } from './runtime';
