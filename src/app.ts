import { validateTicket, validateTicketLabels } from '../lib/ticket-validator';
import { loadTickets, saveTickets } from '../lib/storage';
import type { Ticket } from './models/ticket';

const form = document.querySelector<HTMLFormElement>('#ticket-form');
const list = document.querySelector<HTMLDivElement>('#ticket-list');
const count = document.querySelector<HTMLSpanElement>('#ticket-count');

if (!form || !list || !count) throw new Error('Required application elements are missing.');

let tickets: Ticket[] = [];

function escapeHtml(value: string): string {
  return value.replace(/[&<>'"]/g, char => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;'
  }[char] ?? char));
}

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
    card.innerHTML = `
      <div>
        <strong>${escapeHtml(ticket.label)}</strong>
        ${ticket.plays.map((play, index) => `
          <div>Play ${index + 1}: ${play.numbers.join(' • ')} <b>PB ${play.powerball}</b></div>
        `).join('')}
        ${ticket.doublePlay ? '<small>Double Play: Yes</small>' : ''}
      </div>
      <button class="delete" data-id="${ticket.id}" type="button">Delete</button>
    `;
    list.appendChild(card);
  });
}

async function initialize(): Promise<void> {
  try {
    tickets = await loadTickets();
    render();
  } catch (error) {
    console.error(error);
    alert('Unable to load your saved tickets on this device.');
  }
}

form.addEventListener('submit', async event => {
  event.preventDefault();

  const label = document.querySelector<HTMLInputElement>('#label')?.value.trim() ?? '';
  const rawNumbers = document.querySelector<HTMLInputElement>('#numbers')?.value.trim() ?? '';
  const numbers = rawNumbers ? rawNumbers.split(/\s+/).map(Number) : [];
  const powerball = Number(document.querySelector<HTMLInputElement>('#powerball')?.value);
  const doublePlay = document.querySelector<HTMLInputElement>('#double-play')?.checked ?? false;
  const drawingDate = new Date().toISOString().slice(0, 10);

  const labelValidation = validateTicketLabels(tickets, label);
  if (!labelValidation.valid) {
    alert(labelValidation.error);
    return;
  }

  const play = { numbers, powerball };
  const ticketInput = { label, drawingDate, plays: [play], doublePlay };
  const validation = validateTicket(ticketInput);
  if (!validation.valid) {
    alert(validation.error);
    return;
  }

  const ticket: Ticket = {
    id: crypto.randomUUID(),
    ...ticketInput
  };

  tickets.push(ticket);

  try {
    await saveTickets(tickets);
    form.reset();
    render();
  } catch (error) {
    tickets = tickets.filter(existing => existing.id !== ticket.id);
    console.error(error);
    alert('Unable to save this ticket on the device.');
  }
});

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

void initialize();
