import type { Play, Ticket } from '../src/models/ticket';

export interface PlayMatch {
  playId: string;
  whiteMatches: number;
  powerballMatch: boolean;
}

export interface TicketCheckResult {
  ticketId: string;
  label: string;
  plays: PlayMatch[];
  hasWinner: boolean;
}

/** Check one play against one set of drawing results. */
export function checkPlay(
  play: Play,
  winningNumbers: number[],
  winningPowerball: number
): PlayMatch {
  const winningSet = new Set(winningNumbers);
  const whiteMatches = play.numbers.filter(number => winningSet.has(number)).length;

  return {
    playId: play.id,
    whiteMatches,
    powerballMatch: play.powerball === winningPowerball
  };
}

/** Check every play on a physical ticket. */
export function checkTicket(
  ticket: Ticket,
  winningNumbers: number[],
  winningPowerball: number
): TicketCheckResult {
  const plays = ticket.plays.map(play =>
    checkPlay(play, winningNumbers, winningPowerball)
  );

  return {
    ticketId: ticket.id,
    label: ticket.label,
    plays,
    hasWinner: plays.some(
      play => play.whiteMatches > 0 || play.powerballMatch
    )
  };
}
