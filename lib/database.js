import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';
import { SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, isSupabaseConfigured } from './config.js';

export const supabase = isSupabaseConfigured
  ? createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY)
  : null;

export async function getCurrentUser() {
  if (!supabase) return null;
  const { data, error } = await supabase.auth.getUser();
  if (error) throw error;
  return data.user;
}

export async function signUp(email, password) {
  if (!supabase) throw new Error('Supabase is not configured.');
  const { data, error } = await supabase.auth.signUp({ email, password });
  if (error) throw error;
  return data;
}

export async function signIn(email, password) {
  if (!supabase) throw new Error('Supabase is not configured.');
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw error;
  return data;
}

export async function signOut() {
  if (!supabase) return;
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
}

const TICKET_COLUMNS = 'id, user_id, drawing_date, label, numbers, powerball, power_play, power_play_multiplier, double_play, created_at, updated_at';

export async function loadServerTickets() {
  if (!supabase) return [];
  const user = await getCurrentUser();
  if (!user) return [];

  const { data, error } = await supabase
    .from('tickets')
    .select(TICKET_COLUMNS)
    .eq('user_id', user.id)
    .order('drawing_date', { ascending: false })
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data;
}

export async function createServerTicket(ticket) {
  if (!supabase) throw new Error('Supabase is not configured.');
  const user = await getCurrentUser();
  if (!user) throw new Error('Please sign in before saving tickets.');

  const row = {
    user_id: user.id,
    drawing_date: ticket.drawingDate,
    label: ticket.label,
    numbers: ticket.numbers,
    powerball: ticket.powerball,
    power_play: Boolean(ticket.powerPlay),
    power_play_multiplier: ticket.powerPlay ? Number(ticket.powerPlayMultiplier) : null,
    double_play: Boolean(ticket.doublePlay)
  };

  const { data, error } = await supabase
    .from('tickets')
    .insert(row)
    .select(TICKET_COLUMNS)
    .single();

  if (error) throw error;
  return data;
}

export async function deleteServerTicket(id) {
  if (!supabase) throw new Error('Supabase is not configured.');
  const { error } = await supabase.from('tickets').delete().eq('id', id);
  if (error) throw error;
}
