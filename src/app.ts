import { validateTicket } from '../lib/ticket-validator';
import { loadTickets, saveTickets } from '../lib/storage';

interface Ticket {
  id: string;
  label: string;
  numbers: number[];
  powerball: number;
  doublePlay: boolean;
}

const form = document.querySelector<HTMLFormElement>('#ticket-form');
const list = document.querySelector<HTMLDivElement>('#ticket-list');
const count = document.querySelector<HTMLSpanElement>('#ticket-count');

if (!form || !list || !count) throw new Error('Required application elements are missing.');

let tickets: Ticket[] = loadTickets<Ticket>();

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
        <div>${ticket.numbers.join(' • ')} <b>PB ${ticket.powerball}</b></div>
        ${ticket.doublePlay ? '<small>Double Play: Yes</small>' : ''}
      </div>
      <button class="delete" data-id="${ticket.id}" type="button">Delete</button>
    `;
    list.appendChild(card);
  });
}

form.addEventListener('submit', event => {
  event.preventDefault();

  const label = document.querySelector<HTMLInputElement>('#label')?.value.trim() ?? '';
  const rawNumbers = document.querySelector<HTMLInputElement>('#numbers')?.value.trim() ?? '';
  const numbers = rawNumbers ? rawNumbers.split(/\s+/).map(Number) : [];
  const powerball = Number(document.querySelector<HTMLInputElement>('#powerball')?.value);
  const doublePlay = document.querySelector<HTMLInputElement>('#double-play')?.checked ?? false;

  if (tickets.some(ticket => ticket.label.toLowerCase() === label.toLowerCase())) {
    alert('Each ticket must have a unique label.');
    return;
  }

  const validation = validateTicket({ label, numbers, powerball });
  if (!validation.valid) {
    alert(validation.error);
    return;
  }

  tickets.push({ id: crypto.randomUUID(), label, numbers, powerball, doublePlay });
  saveTickets(tickets);
  form.reset();
  render();
});

list.addEventListener('click', event => {
  const target = event.target;
  if (!(target instanceof Element)) return;
  const button = target.closest<HTMLButtonElement>('.delete');
  if (!button) return;

  tickets = tickets.filter(ticket => ticket.id !== button.dataset.id);
  saveTickets(tickets);
  render();
});

render();
