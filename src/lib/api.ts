import { createSupabaseApi } from './api.supabase'
import { supabase } from './supabase'
import type { Api } from './types'

// The one object every screen talks to. With Supabase keys in .env.local it is
// the real database. Without them, `npm run dev` falls back to the in-memory
// demo for local work. The demo is loaded only in development, so it is never
// part of the published app, and a production build without keys refuses to
// run instead of quietly showing sample data.
async function pickApi(): Promise<Api> {
  if (supabase) return createSupabaseApi(supabase)
  if (import.meta.env.DEV) return (await import('./api.demo')).demoApi
  throw new Error('Missing VITE_SUPABASE_URL or VITE_SUPABASE_PUBLISHABLE_KEY for this build.')
}

export const api: Api = await pickApi()
