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

const TICKET_COLUMNS = 'id, user_id, drawing_date, label, numbers, powerball, power_play, double_play, created_at, updated_at';
const RESULT_COLUMNS = 'id, ticket_id, user_id, drawing_date, main_match_count, main_powerball_match, main_prize_tier, main_prize_amount, double_play_match_count, double_play_powerball_match, double_play_prize_tier, double_play_prize_amount, is_winner, checked_at';
const PAGE_SIZE = 50;

export async function loadServerTicketsPage({ winnersOnly = false, cursor = null, limit = PAGE_SIZE } = {}) {
  if (!supabase) return { tickets: [], nextCursor: null, count: 0 };
  const user = await getCurrentUser();
  if (!user) return { tickets: [], nextCursor: null, count: 0 };

  let query = supabase
    .from('tickets')
    .select(`${TICKET_COLUMNS}, ticket_results!left(${RESULT_COLUMNS})`, { count: 'exact' })
    .eq('user_id', user.id)
    .order('drawing_date', { ascending: false })
    .order('created_at', { ascending: false })
    .order('id', { ascending: false })
    .limit(Math.min(limit, PAGE_SIZE));

  if (winnersOnly) {
    query = query.eq('ticket_results.is_winner', true);
  }

  if (cursor) {
    query = query.lt('id', cursor);
  }

  const { data, error, count } = await query;
  if (error) throw error;

  const tickets = (data || []).map(row => ({
    ...row,
    result: Array.isArray(row.ticket_results) ? row.ticket_results[0] || null : row.ticket_results || null
  }));
  const nextCursor = tickets.length === Math.min(limit, PAGE_SIZE) ? tickets[tickets.length - 1].id : null;
  return { tickets, nextCursor, count: count || 0 };
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

export async function savePushSubscription(subscription) {
  if (!supabase) throw new Error('Supabase is not configured.');
  const user = await getCurrentUser();
  if (!user) throw new Error('Please sign in before enabling notifications.');

  const { data, error } = await supabase
    .from('push_subscriptions')
    .upsert({ user_id: user.id, endpoint: subscription.endpoint, subscription, enabled: true }, { onConflict: 'user_id,endpoint' })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function disablePushSubscriptions() {
  if (!supabase) return;
  const user = await getCurrentUser();
  if (!user) return;
  const { error } = await supabase
    .from('push_subscriptions')
    .update({ enabled: false })
    .eq('user_id', user.id);
  if (error) throw error;
}

export async function loadNotificationStatus() {
  if (!supabase) return false;
  const user = await getCurrentUser();
  if (!user) return false;
  const { data, error } = await supabase
    .from('push_subscriptions')
    .select('id')
    .eq('user_id', user.id)
    .eq('enabled', true)
    .limit(1);
  if (error) throw error;
  return Boolean(data?.length);
}

export async function checkMyTickets(drawingDate) {
  if (!supabase) throw new Error('Supabase is not configured.');
  const { data, error } = await supabase.functions.invoke('check-my-tickets', {
    body: { drawing_date: drawingDate }
  });
  if (error) throw error;
  return data;
}
