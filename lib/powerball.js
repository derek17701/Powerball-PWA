// Core Powerball rules and validation helpers.
export const POWERBALL_RULES = Object.freeze({
  whiteBallCount: 5,
  whiteBallMin: 1,
  whiteBallMax: 69,
  powerballMin: 1,
  powerballMax: 26
});

export function validateNumbers(numbers) {
  if (!Array.isArray(numbers) || numbers.length !== POWERBALL_RULES.whiteBallCount) return false;
  const unique = new Set(numbers);
  return unique.size === numbers.length && numbers.every(Number.isInteger) &&
    numbers.every(n => n >= POWERBALL_RULES.whiteBallMin && n <= POWERBALL_RULES.whiteBallMax);
}

export function validatePowerball(powerball) {
  return Number.isInteger(powerball) &&
    powerball >= POWERBALL_RULES.powerballMin &&
    powerball <= POWERBALL_RULES.powerballMax;
}
