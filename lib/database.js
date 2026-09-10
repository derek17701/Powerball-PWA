import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';
import { SUPABASE_URL, SUPABASE_ANON_KEY, isSupabaseConfigured } from './config.js';

export const supabase = isSupabaseConfigured
  ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
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

export async function loadServerTickets() {
  if (!supabase) return [];
  const user = await getCurrentUser();
  if (!user) return [];

  const { data, error } = await supabase
    .from('tickets')
    .select('id, drawing_date, label, numbers, powerball, double_play, created_at, updated_at')
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
    double_play: Boolean(ticket.doublePlay)
  };

  const { data, error } = await supabase
    .from('tickets')
    .insert(row)
    .select('id, drawing_date, label, numbers, powerball, double_play, created_at, updated_at')
    .single();

  if (error) throw error;
  return data;
}

export async function deleteServerTicket(id) {
  if (!supabase) throw new Error('Supabase is not configured.');
  const { error } = await supabase.from('tickets').delete().eq('id', id);
  if (error) throw error;
}
