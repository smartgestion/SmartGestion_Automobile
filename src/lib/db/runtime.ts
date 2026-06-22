/**
 * Tauri runtime detection.
 *
 * The Supabase-to-SQLite adapter is only active when the app is running
 * inside the Tauri desktop shell. When the same React bundle is loaded
 * in a regular browser (e.g. `npm run dev` → Vite → Express), the real
 * `@supabase/supabase-js` client is used instead, so the cloud-backed
 * development flow keeps working untouched.
 *
 * Detection priority:
 *  1. `window.__TAURI_INTERNALS__` — present in Tauri v2 webviews.
 *  2. `window.__TAURI_IPC__`        — Tauri v1 compatibility (defensive).
 *  3. user-agent contains "Tauri"   — fallback (rarely needed).
 */

declare global {
  // Tauri injects these into the window at runtime.
  interface Window {
    __TAURI_INTERNALS__?: unknown;
    __TAURI_IPC__?: unknown;
  }
}

let cached: boolean | null = null;

export function isTauri(): boolean {
  if (cached !== null) return cached;
  if (typeof window === 'undefined') {
    cached = false;
    return cached;
  }
  cached =
    typeof window.__TAURI_INTERNALS__ !== 'undefined' ||
    typeof window.__TAURI_IPC__ !== 'undefined' ||
    /Tauri/i.test(window.navigator?.userAgent ?? '');
  return cached;
}

/**
 * Thin, lazily-resolved wrapper around `@tauri-apps/api/core::invoke`.
 *
 * We import it dynamically so the module can be safely imported in a plain
 * browser bundle (where the Tauri ESM package is still present but the
 * runtime hooks aren't) without crashing module evaluation.
 */
type InvokeFn = <T = unknown>(
  cmd: string,
  args?: Record<string, unknown>,
) => Promise<T>;

let invokePromise: Promise<InvokeFn> | null = null;

function loadInvoke(): Promise<InvokeFn> {
  if (!invokePromise) {
    invokePromise = import('@tauri-apps/api/core').then(
      (mod) => mod.invoke as InvokeFn,
    );
  }
  return invokePromise;
}

export async function invoke<T = unknown>(
  cmd: string,
  args?: Record<string, unknown>,
): Promise<T> {
  const fn = await loadInvoke();
  return fn<T>(cmd, args);
}

// ---------------------------------------------------------------------------
// Low-level SQL primitives bound to the Rust commands from Task 2.
// ---------------------------------------------------------------------------

export interface ExecuteResult {
  rowsAffected: number;
  lastInsertId: number;
}

export type SqlValue =
  | string
  | number
  | boolean
  | null
  | undefined
  | Record<string, unknown>
  | unknown[];

/**
 * Run an INSERT / UPDATE / DELETE / DDL statement.
 */
export function executeQuery(
  sql: string,
  params: SqlValue[] = [],
): Promise<ExecuteResult> {
  return invoke<ExecuteResult>('execute_query', { sql, params });
}

/**
 * Run a SELECT and get rows as an array of plain objects keyed by column name.
 */
export function fetchRows<T = Record<string, unknown>>(
  sql: string,
  params: SqlValue[] = [],
): Promise<T[]> {
  return invoke<T[]>('fetch_rows', { sql, params });
}

// ---------------------------------------------------------------------------
// Local-auth IPC bindings (Task 4A commands)
//
// The Rust side stores email/role/created_at in snake_case; serde renders
// them as such. The TS surface uses snake_case too so we don't have to
// translate fields back and forth — the rest of the adapter happily reads
// them either way.
// ---------------------------------------------------------------------------

/** Sanitized user object returned by the Rust auth commands. */
export interface RustLocalUser {
  id: string;
  email: string;
  role: string;
  created_at: string;
}

export const rustAuth = {
  /**
   * `true` when the local `users` table has at least one row.
   * Used by the LoginPage to decide whether to show the first-time
   * setup modal.
   */
  hasLocalUsers(): Promise<boolean> {
    return invoke<boolean>('has_local_users');
  },

  /**
   * Create a new local account. Throws on duplicate email or invalid input.
   */
  registerLocalUser(args: {
    email: string;
    password: string;
    role: string;
  }): Promise<RustLocalUser> {
    return invoke<RustLocalUser>('register_local_user', args);
  },

  /**
   * Verify credentials. Throws `invalid credentials` on any failure.
   */
  verifyLocalUser(args: {
    email: string;
    password: string;
  }): Promise<RustLocalUser> {
    return invoke<RustLocalUser>('verify_local_user', args);
  },
};

// ---------------------------------------------------------------------------
// Device fingerprint (Task 7A)
//
// `getMachineId()` returns a SHA-256 hex digest of the OS-assigned
// hardware identifier (Windows MachineGuid / macOS IOPlatformUUID /
// Linux /etc/machine-id). The raw OS identifier is never exposed to
// JavaScript or persisted anywhere — only its hash.
//
// The result is:
//   * deterministic on the same machine (stable across reboots),
//   * different on any other physical or virtual machine,
//   * opaque (64 lowercase-hex characters; not reversible).
//
// Used by the device-binding security layer to enforce that an account
// only logs in from the machine it was bound to.
// ---------------------------------------------------------------------------

/**
 * Read the SHA-256 device fingerprint from the Rust core.
 *
 * Resolves to the 64-char lowercase hex string when running inside
 * Tauri. Rejects with the underlying error string when the OS denies
 * access to the hardware identifier (rare — usually only locked-down
 * enterprise images).
 *
 * Throws synchronously (via the `invoke` dynamic import) when the app
 * is loaded outside Tauri, e.g. in a plain browser dev server. Callers
 * that may run in both environments should guard with `isTauri()`.
 */
export function getMachineId(): Promise<string> {
  return invoke<string>('get_machine_id');
}
