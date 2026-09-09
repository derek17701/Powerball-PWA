import type { Ticket } from '../src/models/ticket';

// IndexedDB is used instead of localStorage because ticket data is structured,
// can grow substantially, and needs room for future synchronization metadata.
const DATABASE_NAME = 'powerball-pwa';
const DATABASE_VERSION = 1;
const TICKET_STORE = 'tickets';

/**
 * Opens the local ticket database and creates its object store on first use.
 * The service worker is responsible for app/offline caching; this database
 * remains the source of the browser's locally stored ticket records.
 */
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

/** Load all tickets saved on this device. */
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

/**
 * Replace the local ticket collection in one read/write transaction.
 * This is intentionally simple for the first version; later sync work can
 * add per-record dirty states, timestamps, and server synchronization.
 */
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
