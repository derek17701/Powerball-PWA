/**
 * Central Powerball game rules used by the client-side validation layer.
 * Keeping these values in one place prevents different parts of the app from
 * accidentally enforcing different number ranges or play limits.
 */
export const POWERBALL_RULES = Object.freeze({
  whiteBallCount: 5,
  whiteBallMin: 1,
  whiteBallMax: 69,
  powerballMin: 1,
  powerballMax: 26,
  maxPlaysPerTicket: 5
});

/**
 * Validates the five white-ball numbers for one play.
 *
 * A valid play must contain exactly five integers, every number must be in
 * the 1–69 range, and no white-ball number may be repeated. The function is
 * intentionally small because both manual entry and future OCR/scanner input
 * can use the same validation rules before a ticket is saved.
 */
export function validateNumbers(numbers: number[]): boolean {
  if (numbers.length !== POWERBALL_RULES.whiteBallCount) return false;
  const unique = new Set(numbers);
  return unique.size === numbers.length &&
    numbers.every(Number.isInteger) &&
    numbers.every(n => n >= POWERBALL_RULES.whiteBallMin && n <= POWERBALL_RULES.whiteBallMax);
}

/**
 * Validates the red Powerball number for one play.
 * The Powerball is separate from the five white balls and uses its own range.
 */
export function validatePowerball(powerball: number): boolean {
  return Number.isInteger(powerball) &&
    powerball >= POWERBALL_RULES.powerballMin &&
    powerball <= POWERBALL_RULES.powerballMax;
}
