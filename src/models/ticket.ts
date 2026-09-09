/** Allowed Power Play multipliers supplied by the official drawing. */
export type PowerPlayMultiplier = 2 | 3 | 4 | 5 | 10;

/** One numbered play belonging to a ticket. */
export interface Play {
  numbers: number[];
  powerball: number;
}

/**
 * Structured data for one saved ticket.
 *
 * The label is entered by the user and is used to identify the ticket when
 * results are displayed. Plays are identified by their position: Play 1,
 * Play 2, and so on, rather than by separate play IDs.
 */
export interface Ticket {
  id: string;
  /** User-entered label used to identify the ticket. */
  label: string;
  /** Drawing calendar date in YYYY-MM-DD format. */
  drawingDate: string;
  /** One to five numbered plays stored under this ticket. */
  plays: Play[];
  /** null means Power Play was not selected. */
  powerPlayMultiplier: PowerPlayMultiplier | null;
  /** True when this ticket also includes Double Play. */
  doublePlay: boolean;
}
