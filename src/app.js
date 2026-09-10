import { validateTicket } from '../lib/ticket-validator.js';
import { loadTickets, saveTickets } from '../lib/storage.js';
import { supabase, getCurrentUser, signUp, signIn, signOut, createServerTicket, deleteServerTicket, loadServerTicketsPage, savePushSubscription, disablePushSubscriptions, loadNotificationStatus, checkMyTickets } from '../lib/database.js';
import { VAPID_PUBLIC_KEY } from '../lib/config.js';

const form = document.querySelector('#ticket-form');
const list = document.querySelector('#ticket-list');
const count = document.querySelector('#ticket-count');
const drawingDateInput = document.querySelector('#drawing-date');
const powerPlayInput = document.querySelector('#power-play');
const authForm = document.querySelector('#auth-form');
const emailInput = document.querySelector('#email');
const passwordInput = document.querySelector('#password');
const accountStatus = document.querySelector('#account-status');
const signUpButton = document.querySelector('#sign-up');
const signOutButton = document.querySelector('#sign-out');
const notificationCard = document.querySelector('#notification-card');
const notificationStatus = document.querySelector('#notification-status');
const notificationsToggle = document.querySelector('#notifications-toggle');
const winnerSummary = document.querySelector('#winner-summary');
const loadMoreButton = document.querySelector('#load-more');
const checkDrawingButton = document.querySelector('#check-drawing');

let tickets = loadTickets();
let currentUser = null;
let normalCursor = null;
let normalTotal = 0;
let winnerCount = 0;
const PAGE_SIZE = 50;

function today() { return new Date().toISOString().slice(0, 10); }
drawingDateInput.value = today();

function normalizeServerTicket(ticket) {
  return { id: ticket.id, userId: ticket.user_id, drawingDate: ticket.drawing_date, label: ticket.label, numbers: ticket.numbers, powerball: ticket.powerball, powerPlay: Boolean(ticket.power_play), doublePlay: Boolean(ticket.double_play), createdAt: ticket.created_at, updatedAt: ticket.updated_at, result: ticket.result || null };
}

function formatPrize(amount, tier) {
  if (tier === 'Jackpot') return 'Jackpot';
  if (amount == null) return tier || 'Winner';
  return `$${Number(amount).toLocaleString()}`;
}

function render() {
  list.innerHTML = '';
  const winnerTickets = tickets.filter(ticket => ticket.result?.is_winner);
  const otherTickets = tickets.filter(ticket => !ticket.result?.is_winner);
  count.textContent = `${normalTotal} ticket${normalTotal === 1 ? '' : 's'}`;
  if (!tickets.length) { list.innerHTML = '<p class="empty">No tickets added yet.</p>'; loadMoreButton.hidden = true; return; }
  if (winnerTickets.length) { winnerSummary.hidden = false; winnerSummary.textContent = `🏆 ${winnerTickets.length}${winnerCount > winnerTickets.length ? '+' : ''} winning ticket${winnerTickets.length === 1 ? '' : 's'} loaded first.`; }
  else winnerSummary.hidden = true;

  [...winnerTickets, ...otherTickets].forEach(ticket => {
    const card = document.createElement('article');
    card.className = `ticket${ticket.result?.is_winner ? ' winner' : ''}`;
    const powerPlayText = ticket.powerPlay ? '<small>Power Play: Yes</small>' : '';
    const resultText = ticket.result?.is_winner ? `<div><strong>🏆 ${escapeHtml(formatPrize(ticket.result.main_prize_amount, ticket.result.main_prize_tier))}</strong></div>` : ticket.result ? '<small>No main-draw prize</small>' : '<small>Not checked yet</small>';
    const doubleText = ticket.result?.double_play_prize_tier ? `<small>Double Play: ${escapeHtml(formatPrize(ticket.result.double_play_prize_amount, ticket.result.double_play_prize_tier))}</small>` : ticket.doublePlay ? '<small>Double Play: Yes</small>' : '';
    card.innerHTML = `<div>${ticket.result?.is_winner ? '<span class="winner-badge">WINNER</span>' : ''}<strong>${escapeHtml(ticket.label)}</strong><div><small>Drawing: ${escapeHtml(ticket.drawingDate || 'Not set')}</small></div><div>${ticket.numbers.join(' • ')} <b>PB ${ticket.powerball}</b></div>${powerPlayText}${doubleText}${resultText}</div><button class="delete" data-id="${ticket.id}" type="button">Delete</button>`;
    list.appendChild(card);
  });
  loadMoreButton.hidden = !normalCursor;
}

function escapeHtml(value) { return String(value).replace(/[&<>'"]/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[char])); }

function setAccountUi() {
  if (!supabase) { accountStatus.textContent = 'Server database is not configured yet. Tickets will use this browser until Supabase is connected.'; signOutButton.hidden = true; notificationCard.hidden = true; return; }
  if (currentUser) { accountStatus.textContent = `Signed in as ${currentUser.email}`; signOutButton.hidden = false; signUpButton.hidden = true; notificationCard.hidden = false; }
  else { accountStatus.textContent = 'Sign in to save your tickets to your account on the server.'; signOutButton.hidden = true; signUpButton.hidden = false; notificationCard.hidden = true; }
}

async function refreshTickets({ reset = true } = {}) {
  if (!currentUser) { render(); return; }
  try {
    if (reset) {
      normalCursor = null;
      tickets = [];
      const winnersPage = await loadServerTicketsPage({ winnersOnly: true, limit: PAGE_SIZE });
      const normalPage = await loadServerTicketsPage({ excludeWinners: true, limit: PAGE_SIZE });
      winnerCount = winnersPage.count;
      normalTotal = normalPage.count + winnerCount;
      tickets = [...winnersPage.tickets.map(normalizeServerTicket), ...normalPage.tickets.map(normalizeServerTicket)];
      normalCursor = normalPage.nextCursor;
    } else {
      const page = await loadServerTicketsPage({ excludeWinners: true, cursor: normalCursor, limit: PAGE_SIZE });
      tickets.push(...page.tickets.map(normalizeServerTicket));
      normalCursor = page.nextCursor;
      normalTotal = page.count + winnerCount;
    }
    render();
  } catch (error) { console.error(error); alert(`Could not load server tickets: ${error.message}`); }
}

async function updateNotificationStatus() {
  if (!currentUser || !supabase) return;
  try { notificationsToggle.checked = await loadNotificationStatus(); notificationStatus.textContent = notificationsToggle.checked ? 'Winning-ticket push notifications are enabled.' : 'Get an alert when one of your tickets wins.'; }
  catch (error) { console.error(error); }
}

function base64ToUint8Array(base64) {
  const padding = '='.repeat((4 - (base64.length % 4)) % 4);
  const base64Url = (base64 + padding).replace(/-/g, '+').replace(/_/g, '/');
  return Uint8Array.from(atob(base64Url), char => char.charCodeAt(0));
}

async function enableNotifications() {
  if (!('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) throw new Error('Push notifications are not supported by this browser.');
  if (!VAPID_PUBLIC_KEY) throw new Error('Push notifications need the app notification key to be configured first.');
  const permission = await Notification.requestPermission();
  if (permission !== 'granted') throw new Error('Notification permission was not granted.');
  const registration = await navigator.serviceWorker.ready;
  let subscription = await registration.pushManager.getSubscription();
  if (!subscription) subscription = await registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: base64ToUint8Array(VAPID_PUBLIC_KEY) });
  await savePushSubscription(subscription.toJSON());
  notificationStatus.textContent = 'Winning-ticket push notifications are enabled.';
}

notificationsToggle.addEventListener('change', async () => {
  if (notificationsToggle.checked) {
    try { await enableNotifications(); }
    catch (error) { notificationsToggle.checked = false; notificationStatus.textContent = error.message; alert(error.message); }
  } else {
    try { await disablePushSubscriptions(); notificationStatus.textContent = 'Winning-ticket push notifications are off.'; }
    catch (error) { console.error(error); alert(`Could not disable notifications: ${error.message}`); }
  }
});

form.addEventListener('submit', async event => {
  event.preventDefault();
  const drawingDate = drawingDateInput.value;
  const label = document.querySelector('#label').value.trim();
  const numbers = document.querySelector('#numbers').value.trim().split(/\s+/).map(Number);
  const powerball = Number(document.querySelector('#powerball').value);
  const powerPlay = powerPlayInput.checked;
  const doublePlay = document.querySelector('#double-play').checked;
  const validation = validateTicket({ label, numbers, powerball });
  if (!validation.valid) { alert(validation.error); return; }
  if (currentUser) {
    try { await createServerTicket({ drawingDate, label, numbers, powerball, powerPlay, doublePlay }); await refreshTickets(); }
    catch (error) { console.error(error); alert(error.code === '23505' ? 'That label is already used for this drawing date. Choose a different label.' : `Could not save ticket: ${error.message}`); return; }
  } else {
    if (tickets.some(ticket => (ticket.drawingDate || '') === drawingDate && ticket.label.toLowerCase() === label.toLowerCase())) { alert('Each ticket label must be unique for its drawing date.'); return; }
    tickets.push({ id: crypto.randomUUID(), drawingDate, label, numbers, powerball, powerPlay, doublePlay }); saveTickets(tickets);
  }
  form.reset(); drawingDateInput.value = drawingDate; render();
});

list.addEventListener('click', async event => {
  const button = event.target.closest('.delete'); if (!button) return;
  if (currentUser) { try { await deleteServerTicket(button.dataset.id); await refreshTickets(); } catch (error) { console.error(error); alert(`Could not delete ticket: ${error.message}`); } return; }
  tickets = tickets.filter(ticket => ticket.id !== button.dataset.id); saveTickets(tickets); render();
});

loadMoreButton.addEventListener('click', () => refreshTickets({ reset: false }));

checkDrawingButton.addEventListener('click', async () => {
  if (!currentUser) { alert('Sign in before checking server tickets.'); return; }
  checkDrawingButton.disabled = true; checkDrawingButton.textContent = 'Checking…';
  try { const result = await checkMyTickets(drawingDateInput.value); alert(`Checked ${result.checked} tickets. ${result.winners} winning ticket${result.winners === 1 ? '' : 's'} found.`); await refreshTickets(); }
  catch (error) { console.error(error); alert(`Could not check tickets: ${error.message}`); }
  finally { checkDrawingButton.disabled = false; checkDrawingButton.textContent = 'Check selected drawing'; }
});

authForm.addEventListener('submit', async event => {
  event.preventDefault(); if (!supabase) { alert('Connect a Supabase project first.'); return; }
  try { await signIn(emailInput.value.trim(), passwordInput.value); currentUser = await getCurrentUser(); passwordInput.value = ''; setAccountUi(); await updateNotificationStatus(); await refreshTickets(); }
  catch (error) { alert(`Sign in failed: ${error.message}`); }
});

signUpButton.addEventListener('click', async () => {
  if (!supabase) { alert('Connect a Supabase project first.'); return; }
  try { const data = await signUp(emailInput.value.trim(), passwordInput.value); if (data.session) { currentUser = data.user; passwordInput.value = ''; setAccountUi(); await updateNotificationStatus(); await refreshTickets(); } else alert('Account created. Check your email to confirm the account, then sign in.'); }
  catch (error) { alert(`Account creation failed: ${error.message}`); }
});

signOutButton.addEventListener('click', async () => {
  try { await signOut(); currentUser = null; tickets = []; winnerCount = 0; normalTotal = 0; setAccountUi(); render(); }
  catch (error) { alert(`Sign out failed: ${error.message}`); }
});

if (supabase) {
  supabase.auth.onAuthStateChange(async (_event, session) => { currentUser = session?.user || null; setAccountUi(); if (currentUser) await updateNotificationStatus(); await refreshTickets(); });
  getCurrentUser().then(async user => { currentUser = user; setAccountUi(); if (currentUser) await updateNotificationStatus(); return refreshTickets(); }).catch(error => console.error(error));
} else setAccountUi();

if ('serviceWorker' in navigator) window.addEventListener('load', () => navigator.serviceWorker.register('./sw.js'));
render();
