export type PowerPlayMultiplier = 2 | 3 | 4 | 5 | 10;
export type DrawingType = 'regular' | 'double_play';

export interface DrawResult {
  whiteNumbers: number[];
  powerball: number;
}

export interface PlayResult {
  playNumber: number;
  whiteMatches: number;
  powerballMatch: boolean;
  prizeTier: string | null;
  prizeAmount: number | null;
  isWinner: boolean;
}

export interface TicketResult {
  drawingType: DrawingType;
  plays: PlayResult[];
  hasWinner: boolean;
  totalPrize: number;
}

function prizeFor(whiteMatches: number, powerballMatch: boolean, drawingType: DrawingType): string | null {
  if (drawingType === 'double_play') {
    if (whiteMatches === 5 && powerballMatch) return 'top_prize';
    if (whiteMatches === 5) return 'match_5';
    if (whiteMatches === 4 && powerballMatch) return 'match_4_plus_powerball';
    if (whiteMatches === 4) return 'match_4';
    if (whiteMatches === 3 && powerballMatch) return 'match_3_plus_powerball';
    if (whiteMatches === 3) return 'match_3';
    if (whiteMatches === 2 && powerballMatch) return 'match_2_plus_powerball';
    if (whiteMatches === 1 && powerballMatch) return 'match_1_plus_powerball';
    if (whiteMatches === 0 && powerballMatch) return 'match_0_plus_powerball';
    return null;
  }

  if (whiteMatches === 5 && powerballMatch) return 'jackpot';
  if (whiteMatches === 5) return 'match_5';
  if (whiteMatches === 4 && powerballMatch) return 'match_4_plus_powerball';
  if (whiteMatches === 4) return 'match_4';
  if (whiteMatches === 3 && powerballMatch) return 'match_3_plus_powerball';
  if (whiteMatches === 3) return 'match_3';
  if (whiteMatches === 2 && powerballMatch) return 'match_2_plus_powerball';
  if (whiteMatches === 1 && powerballMatch) return 'match_1_plus_powerball';
  if (whiteMatches === 0 && powerballMatch) return 'match_0_plus_powerball';
  return null;
}

function basePrize(tier: string, drawingType: DrawingType): number | null {
  if (drawingType === 'double_play') {
    const prizes: Record<string, number> = {
      top_prize: 10_000_000,
      match_5: 500_000,
      match_4_plus_powerball: 50_000,
      match_4: 500,
      match_3_plus_powerball: 500,
      match_3: 20,
      match_2_plus_powerball: 20,
      match_1_plus_powerball: 10,
      match_0_plus_powerball: 7
    };
    return prizes[tier] ?? null;
  }

  const prizes: Record<string, number> = {
    match_5: 1_000_000,
    match_4_plus_powerball: 50_000,
    match_4: 100,
    match_3_plus_powerball: 100,
    match_3: 7,
    match_2_plus_powerball: 7,
    match_1_plus_powerball: 4,
    match_0_plus_powerball: 4
  };
  return prizes[tier] ?? null;
}

export function calculatePlayResult(
  numbers: number[],
  powerball: number,
  playNumber: number,
  drawing: DrawResult,
  drawingType: DrawingType,
  ticketHasPowerPlay: boolean,
  officialPowerPlayMultiplier: PowerPlayMultiplier | null
): PlayResult {
  const winningSet = new Set(drawing.whiteNumbers);
  const whiteMatches = numbers.filter(number => winningSet.has(number)).length;
  const powerballMatch = powerball === drawing.powerball;
  const prizeTier = prizeFor(whiteMatches, powerballMatch, drawingType);
  const base = prizeTier ? basePrize(prizeTier, drawingType) : null;

  let prizeAmount = base;
  if (drawingType === 'regular' && prizeTier === 'jackpot') {
    prizeAmount = null;
  } else if (
    drawingType === 'regular' &&
    base !== null &&
    ticketHasPowerPlay &&
    officialPowerPlayMultiplier !== null &&
    prizeTier !== 'match_5'
  ) {
    prizeAmount = base * officialPowerPlayMultiplier;
  }

  return {
    playNumber,
    whiteMatches,
    powerballMatch,
    prizeTier,
    prizeAmount,
    isWinner: prizeTier !== null
  };
}

export function calculateTicketResult(
  plays: Array<{ numbers: number[]; powerball: number }>,
  drawing: DrawResult,
  drawingType: DrawingType,
  ticketHasPowerPlay: boolean,
  officialPowerPlayMultiplier: PowerPlayMultiplier | null
): TicketResult {
  const results = plays.map((play, index) => calculatePlayResult(
    play.numbers,
    play.powerball,
    index + 1,
    drawing,
    drawingType,
    ticketHasPowerPlay,
    officialPowerPlayMultiplier
  ));

  return {
    drawingType,
    plays: results,
    hasWinner: results.some(result => result.isWinner),
    totalPrize: results.reduce((sum, result) => sum + (result.prizeAmount ?? 0), 0)
  };
}
