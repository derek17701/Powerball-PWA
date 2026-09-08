export interface Play {
  id: string;
  numbers: number[];
  powerball: number;
}

export interface Ticket {
  id: string;
  label: string;
  drawingDate: string;
  plays: Play[];
  doublePlay: boolean;
}
