import { demoApi } from './api.demo'
import { createSupabaseApi } from './api.supabase'
import { supabase } from './supabase'
import type { Api } from './types'

// The one object every screen talks to. With Supabase keys in .env.local it is
// the real database; without them it is the in-memory demo.
export const api: Api = supabase ? createSupabaseApi(supabase) : demoApi
