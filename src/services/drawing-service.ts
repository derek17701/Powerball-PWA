export interface DrawingResult {
  drawDate: string;
  numbers: number[];
  powerball: number;
  doublePlayNumbers?: number[];
}

// Placeholder service boundary for the future official drawing/results integration.
export async function getLatestDrawing(): Promise<DrawingResult | null> {
  return null;
}
