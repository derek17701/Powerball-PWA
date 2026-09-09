import { validateTicket, validateTicketLabels } from '../lib/ticket-validator';
import { loadTickets, saveTickets } from '../lib/storage';
import type { Play, PowerPlayMultiplier, Ticket } from './models/ticket';

// A physical ticket can contain up to five plays. The same limit is enforced
// by the shared validator so the UI and data layer stay in agreement.
const MAX_PLAYS = 5;

// Cache the important form elements once during startup. Failing fast here
// makes an incomplete HTML template much easier to diagnose during development.
const form = document.querySelector<HTMLFormElement>('#ticket-form');
const playsContainer = document.querySelector<HTMLDivElement>('#plays');
const addPlayButton = document.querySelector<HTMLButtonElement>('#add-play');
const list = document.querySelector<HTMLDivElement>('#ticket-list');
const count = document.querySelector<HTMLSpanElement>('#ticket-count');

if (!form || !playsContainer || !addPlayButton || !list || !count) {
  throw new Error('Required application elements are missing.');
}

// The current browser copy of the user's tickets is kept in memory for fast
// rendering. IndexedDB is the persistent local copy and will later be paired
// with server synchronization.
let tickets: Ticket[] = [];
let playCount = 1;

/** Escape user-entered text before placing it into an HTML template. */
function escapeHtml(value: string): string {
  return value.replace(/[&<>'"]/g, char => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;'
  }[char] ?? char));
}

/** Build the editable HTML controls for one numbered play. */
function playMarkup(index: number): string {
  return `
    <fieldset class="play" data-play="${index}">
      <legend>Play ${index}</legend>
      <label>White-ball numbers
        <input class="numbers" required inputmode="numeric" placeholder="1 12 23 34 45" aria-label="Play ${index} white-ball numbers" />
      </label>
      <label>Powerball
        <input class="powerball" required inputmode="numeric" min="1" max="26" placeholder="7" aria-label="Play ${index} Powerball" />
      </label>
      ${index > 1 ? '<button class="remove-play secondary" type="button">Remove play</button>' : ''}
    </fieldset>
  `;
}

/**
 * Rebuild the play editor while preserving values from existingPlays when
 * possible. This is used both for new tickets and when adding/removing plays.
 */
function renderPlayEditor(existingPlays: Play[] = []): void {
  playsContainer.innerHTML = Array.from({ length: playCount }, (_, index) => playMarkup(index + 1)).join('');

  existingPlays.slice(0, playCount).forEach((play, index) => {
    const element = playsContainer.querySelector<HTMLElement>(`.play[data-play="${index + 1}"]`);
    element?.querySelector<HTMLInputElement>('.numbers')?.setAttribute('value', play.numbers.join(' '));
    element?.querySelector<HTMLInputElement>('.powerball')?.setAttribute('value', String(play.powerball));
    const numbersInput = element?.querySelector<HTMLInputElement>('.numbers');
    const powerballInput = element?.querySelector<HTMLInputElement>('.powerball');
    if (numbersInput) numbersInput.value = play.numbers.join(' ');
    if (powerballInput) powerballInput.value = String(play.powerball);
  });

  addPlayButton.disabled = playCount >= MAX_PLAYS;
  addPlayButton.textContent = playCount >= MAX_PLAYS ? 'Maximum 5 plays' : 'Add another play';
}

/** Read the current values from all visible play controls. */
function readPlays(): Play[] {
  return Array.from(playsContainer.querySelectorAll<HTMLElement>('.play')).map(playElement => {
    const rawNumbers = playElement.querySelector<HTMLInputElement>('.numbers')?.value.trim() ?? '';
    const numbers = rawNumbers ? rawNumbers.split(/\s+/).map(Number) : [];
    const powerball = Number(playElement.querySelector<HTMLInputElement>('.powerball')?.value);
    return { numbers, powerball };
  });
}

/**
 * Render the current ticket collection. Labels are escaped because they are
 * user input and are inserted into an HTML string rather than textContent.
 */
function render(): void {
  list.innerHTML = '';
  count.textContent = `${tickets.length} ticket${tickets.length === 1 ? '' : 's'}`;

  if (!tickets.length) {
    list.innerHTML = '<p class="empty">No tickets added yet.</p>';
    return;
  }

  tickets.forEach(ticket => {
    const card = document.createElement('article');
    card.className = 'ticket';
    const multiplier = ticket.powerPlayMultiplier === null ? 'No Power Play' : `Power Play ${ticket.powerPlayMultiplier}X`;
    card.innerHTML = `
      <div class="ticket-info">
        <strong>${escapeHtml(ticket.label)}</strong>
        <small>Drawing: ${escapeHtml(ticket.drawingDate)} · ${multiplier}${ticket.doublePlay ? ' · Double Play' : ''}</small>
        ${ticket.plays.map((play, index) => `
          <div>Play ${index + 1}: ${play.numbers.join(' • ')} <b>PB ${play.powerball}</b></div>
        `).join('')}
      </div>
      <button class="delete" data-id="${ticket.id}" type="button">Delete</button>
    `;
    list.appendChild(card);
  });
}

/** Load the browser's saved tickets before enabling normal UI interaction. */
async function initialize(): Promise<void> {
  try {
    tickets = await loadTickets();
    renderPlayEditor();
    render();
  } catch (error) {
    console.error(error);
    alert('Unable to load your saved tickets on this device.');
  }
}

// Adding a play preserves the values already entered so the user does not
// lose partially completed ticket information while editing.
addPlayButton.addEventListener('click', () => {
  if (playCount < MAX_PLAYS) {
    const currentPlays = readPlays();
    playCount += 1;
    renderPlayEditor(currentPlays);
  }
});

// Event delegation lets dynamically created Remove Play buttons share one
// listener instead of registering a new listener every time the editor changes.
playsContainer.addEventListener('click', event => {
  const target = event.target;
  if (!(target instanceof Element)) return;
  const button = target.closest<HTMLButtonElement>('.remove-play');
  if (!button) return;

  if (playCount > 1) {
    const currentPlays = readPlays();
    playCount -= 1;
    renderPlayEditor(currentPlays.slice(0, playCount));
  }
});

/**
 * Validate and save a new ticket. Local label uniqueness is checked before the
 * record is created; the future server sync must enforce the same rule again
 * because browser-side validation cannot protect against another device.
 */
form.addEventListener('submit', async event => {
  event.preventDefault();

  const label = document.querySelector<HTMLInputElement>('#label')?.value.trim() ?? '';
  const drawingDate = document.querySelector<HTMLInputElement>('#drawing-date')?.value ?? '';
  const multiplierValue = document.querySelector<HTMLSelectElement>('#power-play')?.value ?? '';
  const powerPlayMultiplier = multiplierValue ? Number(multiplierValue) as PowerPlayMultiplier : null;
  const doublePlay = document.querySelector<HTMLInputElement>('#double-play')?.checked ?? false;
  const plays = readPlays();

  const labelValidation = validateTicketLabels(tickets, label, drawingDate);
  if (!labelValidation.valid) {
    alert(labelValidation.error);
    return;
  }

  const ticketInput = { label, drawingDate, plays, powerPlayMultiplier, doublePlay };
  const validation = validateTicket(ticketInput);
  if (!validation.valid) {
    alert(validation.error);
    return;
  }

  // crypto.randomUUID() gives the local record a stable identifier that can
  // also be carried into a later server synchronization operation.
  const ticket: Ticket = { id: crypto.randomUUID(), ...ticketInput };
  tickets.push(ticket);

  try {
    await saveTickets(tickets);
    form.reset();
    playCount = 1;
    renderPlayEditor();
    render();
  } catch (error) {
    // Roll back the in-memory change if IndexedDB could not persist it.
    tickets = tickets.filter(existing => existing.id !== ticket.id);
    console.error(error);
    alert('Unable to save this ticket on the device.');
  }
});

// Ticket deletion uses the same optimistic UI pattern as creation, with an
// in-memory rollback if the IndexedDB write fails.
list.addEventListener('click', async event => {
  const target = event.target;
  if (!(target instanceof Element)) return;
  const button = target.closest<HTMLButtonElement>('.delete');
  if (!button) return;

  const ticketId = button.dataset.id;
  if (!ticketId) return;

  const previousTickets = tickets;
  tickets = tickets.filter(ticket => ticket.id !== ticketId);

  try {
    await saveTickets(tickets);
    render();
  } catch (error) {
    tickets = previousTickets;
    console.error(error);
    alert('Unable to delete this ticket.');
  }
});

// Startup is intentionally asynchronous because IndexedDB must be opened
// before the saved ticket collection can be rendered.
void initialize();
