// Supabase browser configuration.
// These values are safe to expose in a browser when Supabase Row Level Security
// is enabled. Never put a Supabase service-role key here.

export const SUPABASE_URL = '';
export const SUPABASE_ANON_KEY = '';

export const isSupabaseConfigured = Boolean(
  SUPABASE_URL && SUPABASE_ANON_KEY
);
