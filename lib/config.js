// Supabase browser configuration.
// These values are safe to expose in a browser when Supabase Row Level Security
// is enabled. Never put a Supabase service-role key here.

export const SUPABASE_URL = 'https://cjxvlceonqqglxyzdots.supabase.co';

export const SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_iN8zizM96cQr62kMBt9chA_Vp1vY_dL';

// Set this to the public half of the Web Push VAPID key pair.
// The private half must never be committed to this repository.
export const VAPID_PUBLIC_KEY = '';

export const isSupabaseConfigured = Boolean(
  SUPABASE_URL && SUPABASE_PUBLISHABLE_KEY
);
