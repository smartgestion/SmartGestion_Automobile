/**
 * Server-only Supabase clients — must NEVER be imported in browser code.
 *
 * This file is only imported by:
 *   - src/routes/api.ts   (Express route handlers)
 *   - api/index.ts        (Vercel serverless entry)
 *
 * It reads environment variables via process.env (Node.js runtime).
 * Vite excludes this file from the browser bundle because no React
 * component imports it — only the server entry points do.
 */
import { createClient } from "@supabase/supabase-js"

function requireEnv(name: string): string {
  const value = process.env[name]
  if (!value) throw new Error(`Missing server environment variable: ${name}`)
  return value
}

const SUPABASE_URL         = requireEnv("VITE_SUPABASE_URL")
const SUPABASE_ANON_KEY    = requireEnv("VITE_SUPABASE_ANON_KEY")
const SUPABASE_SERVICE_KEY = requireEnv("VITE_SUPABASE_SERVICE_KEY")

/**
 * Public (anon-key) client — used for operations that should respect RLS.
 * Available here so api.ts can use it where needed without importing the
 * browser bundle.
 */
export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)

/**
 * Admin (service-role) client — bypasses all Row-Level Security.
 * Use this for all server-side mutations and queries in api.ts so that
 * they work regardless of which user_id owns the data.
 */
export const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
})
