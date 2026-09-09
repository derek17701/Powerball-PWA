/**
 * Client-side shape for a drawing returned by the future API integration.
 * Keeping the service boundary separate from the UI makes it possible to
 * replace the placeholder with the server-backed implementation without
 * rewriting the ticket-entry components.
 */
export interface DrawingResult {
  drawDate: string;
  numbers: number[];
  powerball: number;
  doublePlayNumbers?: number[];
}

/**
 * Placeholder for the official drawing lookup.
 *
 * The production design keeps official drawing retrieval and winner
 * processing on the server. This function will become the frontend entry
 * point for displaying synchronized results once that API is connected.
 */
export async function getLatestDrawing(): Promise<DrawingResult | null> {
  return null;
}
