import type { Ticket } from '../src/models/ticket';

export interface TicketMatch {
  whiteMatches: number;
  powerballMatch: boolean;
}

export function checkTicket(ticket: Ticket, winningNumbers: number[], winningPowerball: number): TicketMatch {
  const winningSet = new Set(winningNumbers);
  const whiteMatches = ticket.numbers.filter(number => winningSet.has(number)).length;
  return {
    whiteMatches,
    powerballMatch: ticket.powerball === winningPowerball
  };
}
