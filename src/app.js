import { validateTicket } from '../lib/ticket-validator.js';
import { loadTickets, saveTickets } from '../lib/storage.js';
import {
  supabase,
  getCurrentUser,
  signUp,
  signIn,
  signOut,
  loadServerTickets,
  createServerTicket,
  deleteServerTicket
} from '../lib/database.js';

const form = document.querySelector('#ticket-form');
const list = document.querySelector('#ticket-list');
const count = document.querySelector('#ticket-count');
const drawingDateInput = document.querySelector('#drawing-date');
const powerPlayInput = document.querySelector('#power-play');
const powerPlayMultiplierInput = document.querySelector('#power-play-multiplier');
const authForm = document.querySelector('#auth-form');
const emailInput = document.querySelector('#email');
const passwordInput = document.querySelector('#password');
const accountStatus = document.querySelector('#account-status');
const signUpButton = document.querySelector('#sign-up');
const signOutButton = document.querySelector('#sign-out');

let tickets = loadTickets();
let currentUser = null;

function today() {
  return new Date().toISOString().slice(0, 10);
}

drawingDateInput.value = today();

powerPlayInput.addEventListener('change', () => {
  powerPlayMultiplierInput.disabled = !powerPlayInput.checked;
  if (!powerPlayInput.checked) powerPlayMultiplierInput.value = '';
});

function normalizeServerTicket(ticket) {
  return {
    id: ticket.id,
    userId: ticket.user_id,
    drawingDate: ticket.drawing_date,
    label: ticket.label,
    numbers: ticket.numbers,
    powerball: ticket.powerball,
    powerPlay: Boolean(ticket.power_play),
    powerPlayMultiplier: ticket.power_play_multiplier,
    doublePlay: Boolean(ticket.double_play),
    createdAt: ticket.created_at,
    updatedAt: ticket.updated_at
  };
}

function render() {
  list.innerHTML = '';
  count.textContent = `${tickets.length} ticket${tickets.length === 1 ? '' : 's'}`;

  if (!tickets.length) {
    list.innerHTML = '<p class="empty">No tickets added yet.</p>';
    return;
  }

  tickets.forEach(ticket => {
    const card = document.createElement('article');
    card.className = 'ticket';
    const powerPlayText = ticket.powerPlay
      ? `<small>Power Play: ${ticket.powerPlayMultiplier ? `${ticket.powerPlayMultiplier}×` : 'Yes'}</small>`
      : '';
    card.innerHTML = `
      <div>
        <strong>${escapeHtml(ticket.label)}</strong>
        <div><small>Drawing: ${escapeHtml(ticket.drawingDate || 'Not set')}</small></div>
        <div>${ticket.numbers.join(' • ')} <b>PB ${ticket.powerball}</b></div>
        ${powerPlayText}
        ${ticket.doublePlay ? '<small>Double Play: Yes</small>' : ''}
      </div>
      <button class="delete" data-id="${ticket.id}" type="button">Delete</button>
    `;
    list.appendChild(card);
  });
}

function escapeHtml(value) {
  return String(value).replace(/[&<>'"]/g, char => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;'
  }[char]));
}

function setAccountUi() {
  if (!supabase) {
    accountStatus.textContent = 'Server database is not configured yet. Tickets will use this browser until Supabase is connected.';
    signOutButton.hidden = true;
    return;
  }

  if (currentUser) {
    accountStatus.textContent = `Signed in as ${currentUser.email}`;
    signOutButton.hidden = false;
    signUpButton.hidden = true;
  } else {
    accountStatus.textContent = 'Sign in to save your tickets to your account on the server.';
    signOutButton.hidden = true;
    signUpButton.hidden = false;
  }
}

async function refreshTickets() {
  if (!currentUser) {
    render();
    return;
  }

  try {
    tickets = (await loadServerTickets()).map(normalizeServerTicket);
    render();
  } catch (error) {
    console.error(error);
    alert(`Could not load server tickets: ${error.message}`);
  }
}

form.addEventListener('submit', async event => {
  event.preventDefault();
  const drawingDate = drawingDateInput.value;
  const label = document.querySelector('#label').value.trim();
  const numbers = document.querySelector('#numbers').value.trim().split(/\s+/).map(Number);
  const powerball = Number(document.querySelector('#powerball').value);
  const powerPlay = powerPlayInput.checked;
  const powerPlayMultiplier = powerPlay ? Number(powerPlayMultiplierInput.value) : null;
  const doublePlay = document.querySelector('#double-play').checked;

  const validation = validateTicket({ label, numbers, powerball });
  if (!validation.valid) {
    alert(validation.error);
    return;
  }

  if (powerPlay && ![2, 3, 4, 5, 10].includes(powerPlayMultiplier)) {
    alert('Select a valid Power Play multiplier.');
    return;
  }

  if (currentUser) {
    try {
      const created = await createServerTicket({ drawingDate, label, numbers, powerball, powerPlay, powerPlayMultiplier, doublePlay });
      tickets.unshift(normalizeServerTicket(created));
    } catch (error) {
      console.error(error);
      if (error.code === '23505') {
        alert('That label is already used for this drawing date. Choose a different label.');
      } else {
        alert(`Could not save ticket: ${error.message}`);
      }
      return;
    }
  } else {
    if (tickets.some(ticket =>
      (ticket.drawingDate || '') === drawingDate &&
      ticket.label.toLowerCase() === label.toLowerCase()
    )) {
      alert('Each ticket label must be unique for its drawing date.');
      return;
    }

    tickets.push({
      id: crypto.randomUUID(),
      drawingDate,
      label,
      numbers,
      powerball,
      powerPlay,
      powerPlayMultiplier,
      doublePlay
    });
    saveTickets(tickets);
  }

  form.reset();
  drawingDateInput.value = drawingDate;
  powerPlayMultiplierInput.disabled = true;
  render();
});

list.addEventListener('click', async event => {
  const button = event.target.closest('.delete');
  if (!button) return;

  if (currentUser) {
    try {
      await deleteServerTicket(button.dataset.id);
    } catch (error) {
      console.error(error);
      alert(`Could not delete ticket: ${error.message}`);
      return;
    }
  } else {
    tickets = tickets.filter(ticket => ticket.id !== button.dataset.id);
    saveTickets(tickets);
  }

  tickets = tickets.filter(ticket => ticket.id !== button.dataset.id);
  render();
});

authForm.addEventListener('submit', async event => {
  event.preventDefault();
  if (!supabase) {
    alert('Connect a Supabase project first.');
    return;
  }

  try {
    await signIn(emailInput.value.trim(), passwordInput.value);
    currentUser = await getCurrentUser();
    passwordInput.value = '';
    setAccountUi();
    await refreshTickets();
  } catch (error) {
    alert(`Sign in failed: ${error.message}`);
  }
});

signUpButton.addEventListener('click', async () => {
  if (!supabase) {
    alert('Connect a Supabase project first.');
    return;
  }

  try {
    const data = await signUp(emailInput.value.trim(), passwordInput.value);
    if (data.session) {
      currentUser = data.user;
      passwordInput.value = '';
      setAccountUi();
      await refreshTickets();
    } else {
      alert('Account created. Check your email to confirm the account, then sign in.');
    }
  } catch (error) {
    alert(`Account creation failed: ${error.message}`);
  }
});

signOutButton.addEventListener('click', async () => {
  try {
    await signOut();
    currentUser = null;
    tickets = [];
    setAccountUi();
    render();
  } catch (error) {
    alert(`Sign out failed: ${error.message}`);
  }
});

if (supabase) {
  supabase.auth.onAuthStateChange(async (_event, session) => {
    currentUser = session?.user || null;
    setAccountUi();
    await refreshTickets();
  });

  getCurrentUser().then(user => {
    currentUser = user;
    setAccountUi();
    return refreshTickets();
  }).catch(error => console.error(error));
} else {
  setAccountUi();
}

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => navigator.serviceWorker.register('./sw.js'));
}

render();
