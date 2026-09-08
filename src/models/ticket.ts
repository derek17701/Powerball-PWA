export type PowerPlayMultiplier = 2 | 3 | 4 | 5 | 10;

export interface Play {
  numbers: number[];
  powerball: number;
}

export interface Ticket {
  id: string;
  /** User-entered label used to identify the physical ticket. */
  label: string;
  drawingDate: string;
  plays: Play[];
  /** null means Power Play was not selected. */
  powerPlayMultiplier: PowerPlayMultiplier | null;
  doublePlay: boolean;
}
