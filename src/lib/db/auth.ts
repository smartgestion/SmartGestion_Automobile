/**
 * Hybrid auth adapter — Cloud Supabase + local 14-day cache.
 *
 * Sign-in / sign-up always hit Supabase Cloud (network required at the
 * moment of those explicit actions). The returned session is then cached
 * locally in `localStorage.pg_local_session` together with a stamped
 * `local_logged_at` timestamp.
 *
 * On every subsequent boot, `getSession()` tries the cloud first with a
 * short timeout. If the network is reachable, the cache is refreshed and
 * the live session returned. If the network call fails or times out, the
 * cached profile is returned instead — provided it is younger than the
 * configured offline window (14 days). Once that window expires, the
 * cache is purged and a `SIGNED_OUT` event is fired so `AuthContext`
 * sends the user back to the cloud login screen.
 *
 * Only the **auth surface** is hybrid. The application's data layer
 * (`supabase.from(...)`, `.rpc(...)`) still routes through the local
 * SQLite adapter when the app runs inside Tauri — see
 * `src/lib/db/index.ts` and `src/lib/supabase.ts`.
 *
 * Public surface preserved verbatim so call-sites (`AuthContext`,
 * `LoginPage`, etc.) do not need to change.
 */

import {
  createClient,
  type AuthChangeEvent,
  type AuthResponse,
  type Session,
  type Subscription,
  type SupabaseClient,
  type User,
} from '@supabase/supabase-js';

import { getMachineId } from './runtime';

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

/** Storage key for the offline-cached profile blob. */
const CACHE_KEY = 'pg_local_session';

/**
 * Maximum age of a locally-cached session before it must be renewed by
 * a live cloud verification. Spec value: 14 days.
 *
 *   14 * 24 * 60 * 60 * 1000  =  1 209 600 000 ms
 */
const OFFLINE_WINDOW_MS = 14 * 24 * 60 * 60 * 1000;

/**
 * Maximum time (ms) we wait for a Supabase auth call before deciding the
 * cloud is unreachable. Kept short so the UI doesn't hang at boot when
 * the user is genuinely offline.
 */
const CLOUD_TIMEOUT_MS = 3_000;

/**
 * Cadence of the in-process expiry watchdog. The watchdog is a tiny
 * `setInterval` that does nothing but read `local_logged_at` from
 * localStorage and force a sign-out when it crosses the 14-day mark
 * while the app is running. 5 minutes is small enough that a user can
 * never be more than 0.025 % past the window before being kicked out,
 * and large enough that the overhead is invisible.
 */
const EXPIRY_WATCHDOG_INTERVAL_MS = 5 * 60 * 1000;

// ---------------------------------------------------------------------------
// Cached profile shape
// ---------------------------------------------------------------------------

/**
 * What we persist locally. Stores the standard identity fields plus a
 * `local_logged_at` epoch-ms stamp for the 14-day rolling window.
 *
 * We also embed the full Supabase `Session` because that is what
 * `AuthContext` ultimately consumes (`session.user`). Keeping the real
 * session object means the offline path serves the same shape as the
 * online path — no special-casing in any UI code.
 */
interface CachedProfile {
  id: string;
  email: string;
  role: string;
  local_logged_at: number;
  session: Session;
}

// ---------------------------------------------------------------------------
// Shared cloud client (lazy)
// ---------------------------------------------------------------------------

let cloudClient: SupabaseClient | null = null;

/**
 * Build the cloud Supabase client on first use. Delayed so that:
 *
 *   1. Module evaluation never fails on missing env vars at import time
 *      (important for tooling / tests without a `.env` loaded).
 *   2. Offline boots that never call the cloud (cache-hit path) still
 *      work even if the env vars are misconfigured — the client is
 *      simply never constructed.
 */
function getCloudAuthClient(): SupabaseClient {
  if (cloudClient) return cloudClient;

  const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string | undefined;
  const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    throw new Error(
      'Cloud authentication is not configured. Set VITE_SUPABASE_URL and ' +
        'VITE_SUPABASE_ANON_KEY in your environment.',
    );
  }
  cloudClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: false,
    },
  });
  return cloudClient;
}

// ---------------------------------------------------------------------------
// Device-binding (Task 7B)
//
// Each user account is permanently locked to the SHA-256 hardware
// fingerprint of the first machine it signed in (or signed up) from.
// The fingerprint is stored in Supabase user metadata under
// `user_metadata.bound_device_id`.
//
//   • First sign-in / sign-up   → stamp the metadata, allow login.
//   • Same machine on later use → allow login.
//   • Different machine         → reject with the standard
//                                 "Invalid login credentials" envelope
//                                 (the LoginPage toast renders it
//                                 verbatim — no UI changes required).
// ---------------------------------------------------------------------------

/** Supabase user metadata key holding the SHA-256 device fingerprint. */
const BOUND_DEVICE_KEY = 'bound_device_id';

/**
 * Read the current device fingerprint. Returns `null` when the IPC is
 * unavailable (e.g. the bundle is loaded outside Tauri) or the OS denies
 * access to the hardware identifier. The caller is expected to treat
 * `null` as fail-closed.
 */
async function resolveMachineId(): Promise<string | null> {
  try {
    const id = await getMachineId();
    if (typeof id !== 'string' || id.trim() === '') return null;
    return id;
  } catch (err) {
    // Surface the underlying reason in dev console only; never to the UI.
    // eslint-disable-next-line no-console
    console.error('[auth] device fingerprint unavailable:', err);
    return null;
  }
}

/**
 * Build a Supabase-shaped failure envelope that the existing LoginPage
 * toast can render unchanged. The literal string `"Invalid login
 * credentials"` is what the page already maps to the localized
 * `auth.toast_invalid` toast — we deliberately reuse it.
 *
 * The `name`/`status` fields match what `@supabase/supabase-js` produces
 * for `AuthApiError` on bad credentials, so any caller using `instanceof`
 * checks (none in this code base) would still see it as an auth error.
 */
function invalidCredentialsResponse(): AuthResponse {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const error: any = {
    name: 'AuthApiError',
    message: 'Invalid login credentials',
    status: 400,
    code: 'invalid_credentials',
    __isAuthError: true,
  };
  return {
    data: { user: null, session: null },
    error,
  } as AuthResponse;
}

/**
 * Read `bound_device_id` from a Supabase user object.
 * Returns `null` when the field is missing, empty, or not a string.
 */
function readBoundDeviceId(user: User): string | null {
  const meta = user.user_metadata as Record<string, unknown> | null | undefined;
  const v = meta?.[BOUND_DEVICE_KEY];
  if (typeof v !== 'string') return null;
  const trimmed = v.trim();
  return trimmed.length > 0 ? trimmed : null;
}

/**
 * Stamp the current machine fingerprint into the signed-in user's
 * metadata. Called from `signInWithPassword` after Scenario 1 (no prior
 * binding) and from `signUp` (account creation).
 *
 * Returns the refreshed user object if the update succeeded, or `null`
 * on failure so the caller can decide whether to proceed or reject.
 */
async function bindDeviceToUser(machineId: string): Promise<User | null> {
  try {
    const { data, error } = await getCloudAuthClient().auth.updateUser({
      data: { [BOUND_DEVICE_KEY]: machineId },
    });
    if (error || !data.user) {
      // eslint-disable-next-line no-console
      console.error('[auth] failed to stamp bound_device_id:', error);
      return null;
    }
    return data.user;
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('[auth] updateUser threw while stamping bound_device_id:', err);
    return null;
  }
}

// ---------------------------------------------------------------------------
// Cache helpers
// ---------------------------------------------------------------------------

/**
 * `true` when the cached session is at least 14 days old (per spec, the
 * comparison is `>=`, not `>`). Returning `true` means the cache MUST be
 * invalidated and the user re-authenticated against the cloud.
 */
function isCacheExpired(cached: CachedProfile): boolean {
  return Date.now() - cached.local_logged_at >= OFFLINE_WINDOW_MS;
}

function readCache(): CachedProfile | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as CachedProfile;
    if (!parsed?.session?.user?.id || typeof parsed.local_logged_at !== 'number') {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

function writeCache(session: Session): CachedProfile {
  const user = session.user;
  // Role resolution mirrors what Supabase puts on `User`. Production rows
  // tend to set `user.role` to "authenticated"; the actual app role is
  // stored in `user_metadata.role` (set at sign-up time via
  // `options.data.role`). We prefer the metadata role when present so the
  // cached profile reflects "admin" / "user" rather than the generic
  // Supabase role.
  const metadataRole =
    (user.user_metadata as { role?: unknown } | null | undefined)?.role;
  const role =
    typeof metadataRole === 'string' && metadataRole.length > 0
      ? metadataRole
      : (user.role ?? 'user');

  const cached: CachedProfile = {
    id: user.id,
    email: user.email ?? '',
    role,
    local_logged_at: Date.now(),
    session,
  };
  try {
    window.localStorage.setItem(CACHE_KEY, JSON.stringify(cached));
  } catch (err) {
    // Quota exceeded or private-mode storage; non-fatal — the user can
    // still operate online, they just lose the offline window.
    // eslint-disable-next-line no-console
    console.warn('[hybridAuth] failed to write local session cache:', err);
  }
  return cached;
}

function clearCache(): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.removeItem(CACHE_KEY);
  } catch {
    /* ignore */
  }
}

// ---------------------------------------------------------------------------
// Strict 14-day expiration policy
// ---------------------------------------------------------------------------

/**
 * Authoritative expiry check (Task 6C).
 *
 * Reads the local cache, computes `Date.now() - local_logged_at`, and if
 * the delta is greater than or equal to 14 days (1 209 600 000 ms):
 *
 *   1. Wipe `localStorage.pg_local_session` completely.
 *   2. Broadcast a synthetic `SIGNED_OUT` so every subscriber of
 *      `onAuthStateChange` is notified (in particular `AuthContext`,
 *      which drops the user → `ProtectedRoute` then force-redirects
 *      to `/login`).
 *
 * Returns `true` when the policy fired (cache was wiped) so callers
 * can short-circuit any subsequent cloud check — we want the user to
 * land on the login page regardless of network state. The cloud is
 * still reachable for the next explicit sign-in attempt, of course.
 *
 * Idempotent: a second call after the cache is already gone is a no-op.
 */
function enforceExpiryPolicy(): boolean {
  const cached = readCache();
  if (!cached) return false;
  if (!isCacheExpired(cached)) return false;

  clearCache();
  // Defer the broadcast one tick so any awaiter of `getSession()`
  // receives `{ session: null }` before the listener fan-out runs.
  setTimeout(() => emit('SIGNED_OUT', null), 0);
  return true;
}

// ---------------------------------------------------------------------------
// In-process expiry watchdog
//
// `getSession()` already enforces the 14-day window on every call, but
// AuthContext only re-invokes it on mount. A user who keeps the desktop
// app open for two consecutive weeks would otherwise never trip the
// policy. The watchdog plugs that hole with a single lightweight
// localStorage read every 5 minutes.
// ---------------------------------------------------------------------------

let watchdogId: ReturnType<typeof setInterval> | null = null;

function startExpiryWatchdog(): void {
  if (watchdogId !== null) return;
  if (typeof window === 'undefined') return;
  watchdogId = setInterval(() => {
    // The same helper as the boot-time path; running it on a timer is
    // enough to guarantee the policy is enforced even on long-running
    // sessions.
    enforceExpiryPolicy();
  }, EXPIRY_WATCHDOG_INTERVAL_MS);
}

function stopExpiryWatchdog(): void {
  if (watchdogId === null) return;
  clearInterval(watchdogId);
  watchdogId = null;
}

// ---------------------------------------------------------------------------
// Timeout-bounded cloud call
// ---------------------------------------------------------------------------

/**
 * Run `promise` with a hard timeout. Resolves to the result, or rejects
 * with `{ name: 'TimeoutError' }` after `ms` milliseconds. Used by the
 * boot path to fail fast when the network or Supabase is unreachable.
 */
function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const id = setTimeout(() => {
      reject(Object.assign(new Error('cloud auth call timed out'), { name: 'TimeoutError' }));
    }, ms);
    promise.then(
      (value) => {
        clearTimeout(id);
        resolve(value);
      },
      (err) => {
        clearTimeout(id);
        reject(err);
      },
    );
  });
}

// ---------------------------------------------------------------------------
// Custom listener fan-out
//
// We can't blindly forward every Supabase auth event because the
// "cache-hit while offline" path is invisible to the SDK — the SDK never
// emits SIGNED_IN for it. So we maintain our own listener set on top
// and rebroadcast in two scenarios:
//   1. The cache-hit boot path emits a synthetic INITIAL_SESSION.
//   2. The 14-day expiry path emits SIGNED_OUT.
// We still subscribe to the SDK once and relay its events into the
// same listener set so the AuthContext receives every transition.
// ---------------------------------------------------------------------------

type Listener = (event: AuthChangeEvent, session: Session | null) => void;

const listeners = new Set<Listener>();
let sdkSubscribed = false;
let sdkSubscription: Subscription | null = null;

function emit(event: AuthChangeEvent, session: Session | null) {
  for (const cb of listeners) {
    try {
      cb(event, session);
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('[hybridAuth] listener error', err);
    }
  }
}

/**
 * Make sure the SDK's own auth-state-change subscription is active so
 * we can relay live events to our custom listener set. Idempotent.
 */
function ensureSdkSubscription(): void {
  if (sdkSubscribed) return;
  sdkSubscribed = true;
  try {
    const client = getCloudAuthClient();
    const { data } = client.auth.onAuthStateChange((event, session) => {
      // Keep the local cache in sync with whatever the SDK tells us.
      if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
        if (session) writeCache(session);
      } else if (event === 'SIGNED_OUT' || event === 'USER_DELETED') {
        clearCache();
      }
      emit(event, session);
    });
    sdkSubscription = data.subscription;
  } catch {
    // Env not configured / SDK not buildable. We'll still serve the
    // cached profile on getSession(); the SDK relay simply won't fire.
    sdkSubscribed = false;
  }
}

// ---------------------------------------------------------------------------
// Public type re-exports (kept identical to the previous surface).
// ---------------------------------------------------------------------------

export type LocalUser = User;
export type LocalSession = Session;

/** Roles kept for callers that still reference them. */
export const DEFAULT_ROLES = {
  bootstrap: 'admin',
  signUp: 'user',
} as const;

// ---------------------------------------------------------------------------
// Public API — `localAuth.*`
//
// Same export shape as before so AuthContext / LoginPage stay untouched.
// ---------------------------------------------------------------------------

export const localAuth = {
  // ----- session reads -----------------------------------------------

  /**
   * Hybrid session read.
   *
   * Order of operations:
   *   1. Race a real cloud `getSession()` against a 3 s timeout.
   *   2. On cloud success → refresh the cache (rolling 14-day window)
   *      and return the live session.
   *   3. On network error / timeout → look at the cache.
   *        - Fresh (≤14 days) → return the cached session offline.
   *        - Expired           → purge cache, fire SIGNED_OUT, return null.
   *        - Missing           → return null (user must sign in).
   *   4. If the cloud answers with `session === null` → user is
   *      explicitly signed out; clear the cache too.
   *
   * Return envelope matches `@supabase/supabase-js`'s
   * `getSession()` so `AuthContext` sees the same shape.
   */
  async getSession(): Promise<{ data: { session: Session | null }; error: null }> {
    ensureSdkSubscription();
    startExpiryWatchdog();

    // ── Step 0: STRICT 14-day policy (Task 6C) ───────────────────────
    // Run the expiry check BEFORE the cloud call. If the cached session
    // is at least 14 days old, wipe it now and short-circuit to
    // "signed out" — regardless of whether the cloud is reachable.
    // This guarantees an expired cache never serves a session, even on
    // a fast network where the cloud would otherwise refresh it.
    if (enforceExpiryPolicy()) {
      return { data: { session: null }, error: null };
    }

    // ── Step 1: try the cloud ─────────────────────────────────────────
    try {
      const result = await withTimeout(
        getCloudAuthClient().auth.getSession(),
        CLOUD_TIMEOUT_MS,
      );
      const liveSession = result.data.session;

      if (liveSession) {
        // Cloud confirmed a live session — re-stamp the cache so the
        // 14-day offline window restarts from "now".
        writeCache(liveSession);
        return { data: { session: liveSession }, error: null };
      }

      // Cloud reachable but says "no session" → user is signed out,
      // make sure our cache reflects that.
      clearCache();
      return { data: { session: null }, error: null };
    } catch {
      // ── Step 2: cloud unreachable → offline fallback ───────────────
      // The strict expiry check at Step 0 already wiped any stale cache,
      // so anything we read here is guaranteed fresh (< 14 days old).
      const cached = readCache();
      if (!cached) {
        return { data: { session: null }, error: null };
      }
      // Fresh cache: serve the cached session as-is. AuthContext only
      // reads `session.user`, so the embedded user object is enough.
      return { data: { session: cached.session }, error: null };
    }
  },

  /**
   * Returns the current authenticated user, with the same hybrid
   * fall-back as `getSession()`.
   */
  async getUser(): Promise<{ data: { user: User | null }; error: null }> {
    const res = await this.getSession();
    return { data: { user: res.data.session?.user ?? null }, error: null };
  },

  // ----- sign-in / sign-up --------------------------------------------

  /**
   * Authenticate against Supabase cloud with **strict device binding**
   * (Task 7B). Requires an internet connection. The flow:
   *
   *   0. Resolve the current machine fingerprint (SHA-256 of the
   *      OS-assigned hardware GUID, via the Rust IPC).
   *   1. Run the standard cloud `signInWithPassword`.
   *   2. If the credentials are wrong, return verbatim — Supabase has
   *      already shaped the error.
   *   3. Compare `user_metadata.bound_device_id` to the current
   *      fingerprint:
   *
   *        • empty / null  → Scenario 1: first-ever login. Stamp the
   *                          fingerprint into the user's metadata and
   *                          allow.
   *        • equal          → Scenario 2: same machine. Allow.
   *        • mismatched     → Scenario 3: reject. We DO NOT throw a
   *                          custom error; instead we sign the user
   *                          out of the SDK (so the freshly-created
   *                          session is discarded) and return a
   *                          standard Supabase failure envelope with
   *                          `message: "Invalid login credentials"`,
   *                          which the existing LoginPage toast maps
   *                          to the localized `auth.toast_invalid`
   *                          message. No UI changes required.
   *
   *   4. On allowed paths, the (possibly refreshed) session is cached
   *      locally so the user keeps working offline for the next 14
   *      days, then returned to the caller.
   */
  async signInWithPassword(creds: { email: string; password: string }) {
    ensureSdkSubscription();

    // ── Step 0: resolve the device fingerprint up-front ───────────────
    // Fail-closed: if we can't read it (browser-only bundle, locked-down
    // enterprise registry, etc.) we refuse the login entirely.
    const currentMachineId = await resolveMachineId();
    if (!currentMachineId) {
      // eslint-disable-next-line no-console
      console.error(
        '[auth] rejecting sign-in: device fingerprint unavailable',
      );
      return invalidCredentialsResponse();
    }

    // ── Step 1: standard cloud sign-in ────────────────────────────────
    const res = await getCloudAuthClient().auth.signInWithPassword(creds);
    if (res.error || !res.data.session || !res.data.user) {
      // Credentials wrong / network failure — surface Supabase's
      // envelope as-is. The LoginPage already maps "Invalid login
      // credentials" to the localized toast.
      return res;
    }

    // ── Step 3: device-binding check ──────────────────────────────────
    const boundId = readBoundDeviceId(res.data.user);

    if (boundId === null) {
      // Scenario 1 — First-time login: stamp the metadata so all future
      // logins are pinned to this machine.
      const refreshed = await bindDeviceToUser(currentMachineId);
      if (!refreshed) {
        // updateUser failed; do not silently allow an unbound session.
        // Discard the half-created session and report a generic error.
        try {
          await getCloudAuthClient().auth.signOut();
        } catch {
          /* ignore */
        }
        return invalidCredentialsResponse();
      }
      // Merge the freshest user (with metadata) into the returned
      // session so callers and the local cache reflect the binding
      // immediately, without needing a second round-trip.
      const sessionWithBoundUser: Session = {
        ...res.data.session,
        user: refreshed,
      };
      writeCache(sessionWithBoundUser);
      return {
        data: { user: refreshed, session: sessionWithBoundUser },
        error: null,
      } as AuthResponse;
    }

    if (boundId !== currentMachineId) {
      // Scenario 3 — Different machine: reject. Sign the user out of
      // the SDK so no session lingers in localStorage on the wrong
      // device, then return the standard failure envelope.
      // eslint-disable-next-line no-console
      console.error(
        '[auth] device fingerprint mismatch: account is bound to a different machine.',
        { boundIdHead: boundId.slice(0, 12), currentHead: currentMachineId.slice(0, 12) },
      );
      try {
        await getCloudAuthClient().auth.signOut();
      } catch {
        /* ignore */
      }
      clearCache();
      return invalidCredentialsResponse();
    }

    // Scenario 2 — Same machine, allow & refresh cache.
    writeCache(res.data.session);
    return res;
  },

  /**
   * Create a new account on Supabase cloud and cache the resulting
   * session.
   *
   * **Device binding (Task 7B):** the current machine fingerprint is
   * folded into `options.data.bound_device_id` so the account is locked
   * to this machine from the very first second of its existence. A
   * subsequent attempt to sign in from any other machine will fail the
   * device-binding check in `signInWithPassword`. If the fingerprint
   * cannot be resolved (non-Tauri runtime or locked-down OS), the
   * request is rejected with the standard "Invalid login credentials"
   * envelope so no unbound account is ever created.
   *
   * Supports the same `options.data` metadata the SDK accepts (e.g.
   * `{ role: 'user' }`); any caller-supplied fields are preserved
   * alongside `bound_device_id`.
   */
  async signUp(creds: {
    email: string;
    password: string;
    options?: { data?: Record<string, unknown> };
  }) {
    ensureSdkSubscription();

    // Fail-closed: refuse to create an account we couldn't bind.
    const currentMachineId = await resolveMachineId();
    if (!currentMachineId) {
      // eslint-disable-next-line no-console
      console.error(
        '[auth] rejecting sign-up: device fingerprint unavailable',
      );
      return invalidCredentialsResponse();
    }

    // Merge caller metadata with the device id. `bound_device_id` wins
    // on collision so a caller cannot bypass binding by supplying their
    // own value.
    const callerData = creds.options?.data ?? {};
    const mergedOptions = {
      ...creds.options,
      data: { ...callerData, [BOUND_DEVICE_KEY]: currentMachineId },
    };

    const res = await getCloudAuthClient().auth.signUp({
      email: creds.email,
      password: creds.password,
      options: mergedOptions,
    });
    if (!res.error && res.data.session) {
      writeCache(res.data.session);
    }
    return res;
  },

  // ----- sign-out -----------------------------------------------------

  /**
   * Manual sign-out (Task 6C).
   *
   * Wipes `localStorage.pg_local_session` **first**, before any network
   * call, so the local session is invalidated instantly regardless of
   * whether the cloud is reachable. The cloud sign-out is then attempted
   * on a best-effort basis. Finally a synthetic `SIGNED_OUT` event is
   * broadcast so the application layout wrappers (AuthContext →
   * ProtectedRoute) drop the user and redirect to `/login`.
   *
   * The expiry watchdog is stopped here too so it doesn't keep firing
   * useless localStorage reads while no one is signed in.
   */
  async signOut(): Promise<{ error: null }> {
    // Step 1: wipe storage NOW (before any await).
    clearCache();
    stopExpiryWatchdog();

    // Step 2: best-effort cloud sign-out.
    try {
      await getCloudAuthClient().auth.signOut();
    } catch {
      /* network may be down; local sign-out already done */
    }

    // Step 3: notify the app so it can redirect to /login.
    setTimeout(() => emit('SIGNED_OUT', null), 0);
    return { error: null };
  },

  // ----- subscription -------------------------------------------------

  /**
   * Subscribe to auth state changes. Returns the same
   * `{ data: { subscription: { unsubscribe } } }` shape as Supabase.
   *
   * We manage our own listener set (not just a passthrough) so that
   * synthetic events from the hybrid layer — the cache-hit boot path
   * and the 14-day expiry — reach subscribers too.
   */
  onAuthStateChange(callback: Listener) {
    ensureSdkSubscription();
    // Make sure the in-process expiry watchdog is running for as long as
    // anyone cares about auth events. It is automatically torn down by
    // `unsubscribe` below when the last listener leaves.
    startExpiryWatchdog();
    listeners.add(callback);
    return {
      data: {
        subscription: {
          id: Math.random().toString(36).slice(2),
          callback,
          unsubscribe() {
            listeners.delete(callback);
            // If this was the last listener, also tear down the SDK
            // subscription + watchdog so we don't leak anything across
            // hot-reloads.
            if (listeners.size === 0) {
              if (sdkSubscription) {
                try {
                  sdkSubscription.unsubscribe();
                } catch {
                  /* ignore */
                }
                sdkSubscription = null;
                sdkSubscribed = false;
              }
              stopExpiryWatchdog();
            }
          },
        },
      },
    };
  },

  // ----- legacy compatibility -----------------------------------------
  //
  // Tasks 4A / 4B added two helpers that the cloud flow doesn't need.
  // Kept as safe stubs so any straggler import still compiles.

  /**
   * Always resolves to `true`. The first-time setup popup has been
   * removed; this stub short-circuits any leftover guard immediately.
   */
  async hasLocalUsers(): Promise<boolean> {
    return true;
  },

  /**
   * Forwards to `signUp` with the admin role. Raises a clear error on
   * failure so any caller still using this entry point gets actionable
   * feedback.
   */
  async registerBootstrap(creds: { email: string; password: string }) {
    const res = await this.signUp({
      email: creds.email,
      password: creds.password,
      options: { data: { role: DEFAULT_ROLES.bootstrap } },
    });
    if (res.error) {
      throw new Error(res.error.message);
    }
    return { user: res.data.user, session: res.data.session };
  },
};

export type LocalAuth = typeof localAuth;
