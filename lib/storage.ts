import type { Ticket } from '../src/models/ticket';

const DATABASE_NAME = 'powerball-pwa';
const DATABASE_VERSION = 1;
const TICKET_STORE = 'tickets';

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DATABASE_NAME, DATABASE_VERSION);

    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains(TICKET_STORE)) {
        database.createObjectStore(TICKET_STORE, { keyPath: 'id' });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('Unable to open ticket database.'));
  });
}

export async function loadTickets(): Promise<Ticket[]> {
  const database = await openDatabase();

  return new Promise((resolve, reject) => {
    const transaction = database.transaction(TICKET_STORE, 'readonly');
    const request = transaction.objectStore(TICKET_STORE).getAll();

    request.onsuccess = () => resolve(request.result as Ticket[]);
    request.onerror = () => reject(request.error ?? new Error('Unable to load tickets.'));
    transaction.oncomplete = () => database.close();
    transaction.onerror = () => reject(transaction.error ?? new Error('Unable to load tickets.'));
  });
}

export async function saveTickets(tickets: Ticket[]): Promise<void> {
  const database = await openDatabase();

  return new Promise((resolve, reject) => {
    const transaction = database.transaction(TICKET_STORE, 'readwrite');
    const store = transaction.objectStore(TICKET_STORE);

    store.clear();
    for (const ticket of tickets) {
      store.put(ticket);
    }

    transaction.oncomplete = () => {
      database.close();
      resolve();
    };
    transaction.onerror = () => {
      database.close();
      reject(transaction.error ?? new Error('Unable to save tickets.'));
    };
    transaction.onabort = () => {
      database.close();
      reject(transaction.error ?? new Error('Unable to save tickets.'));
    };
  });
}
