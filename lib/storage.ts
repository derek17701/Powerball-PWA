const STORAGE_KEY = 'powerball-tickets-v1';

export function loadTickets<T>(): T[] {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]') as T[];
  } catch {
    return [];
  }
}

export function saveTickets<T>(tickets: T[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(tickets));
}
