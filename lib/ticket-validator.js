import { validateNumbers, validatePowerball } from './powerball.js';

export function validateTicket({ label, numbers, powerball }) {
  if (!label || typeof label !== 'string' || !label.trim()) {
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
