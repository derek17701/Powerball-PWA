const form = document.querySelector('#ticket-form');
const list = document.querySelector('#ticket-list');
const count = document.querySelector('#ticket-count');
const STORAGE_KEY = 'powerball-tickets-v1';

let tickets = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');

function save() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(tickets));
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

  if (numbers.length !== 5 || numbers.some(n => !Number.isInteger(n) || n < 1 || n > 69)) {
    alert('Enter five white-ball numbers from 1 to 69.');
    return;
  }

  if (!Number.isInteger(powerball) || powerball < 1 || powerball > 26) {
    alert('Enter a Powerball number from 1 to 26.');
    return;
  }

  tickets.push({ id: crypto.randomUUID(), label, numbers, powerball, doublePlay });
  save();
  form.reset();
  render();
});

list.addEventListener('click', event => {
  const button = event.target.closest('.delete');
  if (!button) return;
  tickets = tickets.filter(ticket => ticket.id !== button.dataset.id);
  save();
  render();
});

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => navigator.serviceWorker.register('./sw.js'));
}

render();
