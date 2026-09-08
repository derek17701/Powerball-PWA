export interface Play {
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
