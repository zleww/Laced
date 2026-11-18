import { createClient, type SupabaseClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL
const publishableKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY

// True once .env.local has both values. The app shows a setup notice until then.
export const isSupabaseConfigured = Boolean(url && publishableKey)

// One shared client for the whole app. The publishable key is public by design;
// row-level security in Postgres decides what each signed-in user can read or write.
export const supabase: SupabaseClient | null =
  url && publishableKey ? createClient(url, publishableKey) : null
