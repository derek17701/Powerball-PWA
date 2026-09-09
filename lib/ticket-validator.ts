import { POWERBALL_RULES, validateNumbers, validatePowerball } from './powerball';
import type { Play, PowerPlayMultiplier, Ticket } from '../src/models/ticket';

/** The fields needed to validate a ticket before it is converted to a Ticket record. */
export interface TicketInput {
  label: string;
  drawingDate: string;
  plays: Play[];
  powerPlayMultiplier: PowerPlayMultiplier | null;
  doublePlay: boolean;
}

/** Consistent result shape returned by the validation functions. */
export interface ValidationResult {
  valid: boolean;
  error?: string;
}

/**
 * Validates one play using the central Powerball number rules.
 * Keeping play validation separate lets the scanner/review screen reuse the
 * exact same checks as manual entry in the future.
 */
export function validatePlay(play: Play): ValidationResult {
  if (!validateNumbers(play.numbers)) {
    return { valid: false, error: 'Enter five unique white-ball numbers from 1 to 69 for each play.' };
  }

  if (!validatePowerball(play.powerball)) {
    return { valid: false, error: 'Enter a Powerball number from 1 to 26 for each play.' };
  }

  return { valid: true };
}

/**
 * Validates the ticket-level fields and every play before saving.
 * The label is checked for presence here; uniqueness is handled separately
 * because it depends on the user's existing tickets and drawing date.
 */
export function validateTicket({ label, drawingDate, plays, powerPlayMultiplier }: TicketInput): ValidationResult {
  if (!label.trim()) {
    return { valid: false, error: 'A unique ticket label is required. Enter it manually.' };
  }

  if (!/^\d{4}-\d{2}-\d{2}$/.test(drawingDate)) {
    return { valid: false, error: 'Enter a valid drawing date.' };
  }

  if (plays.length < 1 || plays.length > POWERBALL_RULES.maxPlaysPerTicket) {
    return {
      valid: false,
      error: `A ticket must contain between 1 and ${POWERBALL_RULES.maxPlaysPerTicket} plays.`
    };
  }

  if (powerPlayMultiplier !== null && ![2, 3, 4, 5, 10].includes(powerPlayMultiplier)) {
    return { valid: false, error: 'Select a valid Power Play multiplier.' };
  }

  for (const play of plays) {
    const result = validatePlay(play);
    if (!result.valid) return result;
  }

  return { valid: true };
}

/**
 * Checks the local ticket list for a duplicate label on the same drawing date.
 * Labels are normalized for comparison so capitalization and surrounding
 * spaces do not create two labels that appear different but are effectively
 * the same to a user. The server enforces the same rule authoritatively.
 */
export function validateTicketLabels(
  tickets: Ticket[],
  label: string,
  drawingDate: string,
  excludeTicketId?: string
): ValidationResult {
  const normalizedLabel = label.trim().toLowerCase();
  const duplicate = tickets.some(
    ticket => ticket.id !== excludeTicketId &&
      ticket.drawingDate === drawingDate &&
      ticket.label.trim().toLowerCase() === normalizedLabel
  );

  return duplicate
    ? { valid: false, error: 'Each ticket label must be unique for its drawing date.' }
    : { valid: true };
}
