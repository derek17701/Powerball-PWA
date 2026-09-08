import { validateNumbers, validatePowerball } from './powerball';

export interface TicketInput {
  label: string;
  numbers: number[];
  powerball: number;
}

export interface ValidationResult {
  valid: boolean;
  error?: string;
}

export function validateTicket({ label, numbers, powerball }: TicketInput): ValidationResult {
  if (!label.trim()) {
    return { valid: false, error: 'A unique ticket label is required.' };
  }
  if (!validateNumbers(numbers)) {
    return { valid: false, error: 'Enter five unique white-ball numbers from 1 to 69.' };
  }
  if (!validatePowerball(powerball)) {
    return { valid: false, error: 'Enter a Powerball number from 1 to 26.' };
  }
  return { valid: true };
}
