import { validateTicket } from '../lib/ticket-validator.js';
import { loadTickets, saveTickets } from '../lib/storage.js';

const form = document.querySelector('#ticket-form');
const list = document.querySelector('#ticket-list');
const count = document.querySelector('#ticket-count');

let tickets = loadTickets();

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

function escapeHtml(value) {
  return value.replace(/[&<>'"]/g, char => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;'
  }[char]));
}

form.addEventListener('submit', event => {
  event.preventDefault();
  const label = document.querySelector('#label').value.trim();
  const numbers = document.querySelector('#numbers').value.trim().split(/\s+/).map(Number);
  const powerball = Number(document.querySelector('#powerball').value);
  const doublePlay = document.querySelector('#double-play').checked;

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
  const button = event.target.closest('.delete');
  if (!button) return;
  tickets = tickets.filter(ticket => ticket.id !== button.dataset.id);
  saveTickets(tickets);
  render();
});

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => navigator.serviceWorker.register('./sw.js'));
}

render();
