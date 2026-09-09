import type { Play, Ticket } from '../src/models/ticket';

/** Match counts for one play, without calculating the monetary prize. */
export interface PlayMatch {
  playNumber: number;
  whiteMatches: number;
  powerballMatch: boolean;
}

/** Lightweight client-side summary used for quick local result checks. */
export interface TicketCheckResult {
  ticketId: string;
  label: string;
  plays: PlayMatch[];
  hasWinner: boolean;
}

/**
 * Compare one play with one set of drawing numbers.
 * This helper only counts matching numbers; the server winner engine remains
 * authoritative for official prize tiers and prize amounts.
 */
export function checkPlay(
  play: Play,
  playNumber: number,
  winningNumbers: number[],
  winningPowerball: number
): PlayMatch {
  const winningSet = new Set(winningNumbers);
  const whiteMatches = play.numbers.filter(number => winningSet.has(number)).length;

  return {
    playNumber,
    whiteMatches,
    powerballMatch: play.powerball === winningPowerball
  };
}

/**
 * Check every play on a ticket for matching numbers.
 * This is intended for fast local feedback; it should not replace the server's
 * official prize calculation when results are finalized.
 */
export function checkTicket(
  ticket: Ticket,
  winningNumbers: number[],
  winningPowerball: number
): TicketCheckResult {
  const plays = ticket.plays.map((play, index) =>
    checkPlay(play, index + 1, winningNumbers, winningPowerball)
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
