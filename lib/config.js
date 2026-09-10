// Supabase browser configuration.
// These values are safe to expose in a browser when Supabase Row Level Security
// is enabled. Never put a Supabase service-role key here.

export const SUPABASE_URL = 'https://cjxvlceonqqglxyzdots.supabase.co';

export const SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_iN8zizM96cQr62kMBt9chA_Vp1vY_dL';

// Public Web Push VAPID key. The private half is kept server-side only.
export const VAPID_PUBLIC_KEY = 'BAVClwqtzQf2kH9D1SVhD7ZgeWMI7ke45YACq2qsbWFw5ttDw4uaqh7x-7BPvv3vAfUyqjIuTMK7hkW5nEPsfkw';

export const isSupabaseConfigured = Boolean(
  SUPABASE_URL && SUPABASE_PUBLISHABLE_KEY
);
