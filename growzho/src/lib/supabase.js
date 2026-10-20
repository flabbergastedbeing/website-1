import { createClient } from '@supabase/supabase-js'

// Both values come from your .env file (see .env.example). The anon key is meant to be public: what a visitor can do with it is
// decided by the row-level-security rules in supabase/schema.sql (they may add a submission, never read or delete one).
const url = import.meta.env.VITE_SUPABASE_URL
const key = import.meta.env.VITE_SUPABASE_ANON_KEY

export const supabaseReady = Boolean(url && key)
export const supabase = supabaseReady ? createClient(url, key, { auth: { persistSession: true, autoRefreshToken: true } }) : null