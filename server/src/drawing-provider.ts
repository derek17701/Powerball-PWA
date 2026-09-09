/**
 * NY Open Data endpoint used to retrieve the latest published Powerball row.
 * The server treats this provider data as the input to the authoritative
 * drawing-processing pipeline rather than trusting values supplied by the app.
 */
export const POWERBALL_RESULTS_API = 'https://data.ny.gov/resource/d6yy-54nr.json?$order=draw_date%20DESC&$limit=1';

/** Normalized drawing data used by the server's winner engine. */
export interface ProviderDrawing {
  drawingDate: string;
  whiteNumbers: number[];
  powerball: number;
  powerPlayMultiplier: 2 | 3 | 4 | 5 | 10;
  doublePlay: { whiteNumbers: number[]; powerball: number } | null;
  source: string;
}

/** Shape returned by the NY Open Data API. */
type ApiRow = {
  draw_date?: string;
  winning_numbers?: string;
  multiplier?: string | number;
  double_play_winning_numbers?: string | null;
};

/** Convert the provider's whitespace-separated number string into integers. */
function parseNumbers(value: string | undefined): number[] {
  if (!value) return [];
  return value
    .trim()
    .split(/\s+/)
    .map(Number)
    .filter(Number.isInteger);
}

/**
 * The provider stores five white balls followed by the Powerball.
 * Return null rather than accepting incomplete data so a bad provider row
 * cannot silently become a valid drawing in our database.
 */
function parseSixNumbers(value: string | undefined): { whiteNumbers: number[]; powerball: number } | null {
  const numbers = parseNumbers(value);
  if (numbers.length !== 6) return null;
  return { whiteNumbers: numbers.slice(0, 5), powerball: numbers[5] };
}

/** Normalize the provider's date into the app's YYYY-MM-DD format. */
function parseDate(value: string | undefined): string | null {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString().slice(0, 10);
}

/**
 * Fetch and validate the newest available drawing from the provider.
 * Double Play may be absent temporarily; that is expected and allows the
 * scheduled retry process to obtain it later without treating the first call
 * as a permanent failure.
 */
export async function fetchLatestPowerballDrawing(): Promise<ProviderDrawing> {
  const response = await fetch(POWERBALL_RESULTS_API, {
    headers: { Accept: 'application/json' }
  });
  if (!response.ok) throw new Error(`Powerball results API returned HTTP ${response.status}`);

  const rows = await response.json() as ApiRow[];
  if (!Array.isArray(rows) || rows.length === 0) throw new Error('Powerball results API returned no drawing rows.');

  const row = rows[0];
  const regular = parseSixNumbers(row.winning_numbers);
  const drawingDate = parseDate(row.draw_date);
  if (!regular || !drawingDate) throw new Error('Powerball results API returned an invalid regular drawing.');

  // The multiplier is required because prize calculation must use the official
  // multiplier from the drawing, not a value guessed by the client.
  const multiplierNumber = Number(row.multiplier);
  if (![2, 3, 4, 5, 10].includes(multiplierNumber)) {
    throw new Error('Powerball results API returned an invalid Power Play multiplier.');
  }
  const powerPlayMultiplier = multiplierNumber as 2 | 3 | 4 | 5 | 10;

  const doublePlay = parseSixNumbers(row.double_play_winning_numbers ?? undefined);

  return {
    drawingDate,
    whiteNumbers: regular.whiteNumbers,
    powerball: regular.powerball,
    powerPlayMultiplier,
    doublePlay,
    source: POWERBALL_RESULTS_API
  };
}
