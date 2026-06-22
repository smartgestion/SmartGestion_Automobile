/**
 * scripts/api-entry.ts — Source for the Vercel Serverless Function bundle.
 *
 * This file is the esbuild ENTRY POINT for `api/index.js`. It is intentionally
 * placed OUTSIDE the `api/` directory so that Vercel does NOT auto-detect it
 * as a serverless function (which would conflict with the prebuilt
 * `api/index.js` we ship).
 *
 * Build pipeline:
 *   npm run build:api   →   esbuild scripts/api-entry.ts → api/index.js
 *
 * The bundled output `api/index.js` is the actual function Vercel deploys.
 * It is committed to git so Vercel can find it during function registration
 * (the `functions` glob in vercel.json is matched BEFORE buildCommand runs,
 * so generated files won't be discovered if they're gitignored).
 *
 * Vercel routes every /api/* request to this function via vercel.json
 * rewrites. We wrap the existing Express router so no route changes
 * are needed between local dev (server.ts) and production (this file).
 */

import 'dotenv/config'
import express from 'express'
import type { Request, Response } from 'express'
import apiRouter from '../src/routes/api.js'

const app = express()

// Body parser limits must match server.ts
app.use(express.json({ limit: '50mb' }))
app.use(express.urlencoded({ extended: true, limit: '50mb' }))

// IMPORTANT: when Vercel rewrites a request via an explicit `rewrites` rule
// (see vercel.json), the original URL is preserved verbatim — the `/api`
// prefix is NOT stripped. So `PUT /api/bons-commande/5/statut` arrives here
// with `req.url === "/api/bons-commande/5/statut"`. We therefore mount the
// router under `/api` so the inner route definitions (e.g. `/bons-commande
// /:id/statut`) match. This mirrors `server.ts` which also uses `app.use(
// '/api', apiRouter)`.
app.use('/api', apiRouter)

// Lightweight health check so we can confirm the function is reachable
// without depending on Supabase.
app.get('/api/_health', (_req, res) => {
  res.json({ ok: true, ts: new Date().toISOString() })
})

// Vercel serverless handler — receives (req, res) for every matched request
export default function handler(req: Request, res: Response) {
  return app(req, res)
}
