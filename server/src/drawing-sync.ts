import { Pool } from 'pg';

const databaseUrl = process.env.DATABASE_URL;
const syncUrl = process.env.DRAWING_SYNC_URL;
const ingestToken = process.env.DRAWING_INGEST_TOKEN;

if (!databaseUrl || !syncUrl || !ingestToken) {
  throw new Error('DATABASE_URL, DRAWING_SYNC_URL, and DRAWING_INGEST_TOKEN must be set for drawing synchronization.');
}

const pool = new Pool({ connectionString: databaseUrl, max: 2 });

function easternParts(date: Date): Record<string, string> {
  return Object.fromEntries(
    new Intl.DateTimeFormat('en-US', {
      timeZone: 'America/New_York',
      weekday: 'short',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23'
    }).formatToParts(date)
      .filter(part => part.type !== 'literal')
      .map(part => [part.type, part.value])
  );
}

function previousCalendarDate(dateText: string): string {
  const [year, month, day] = dateText.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  date.setUTCDate(date.getUTCDate() - 1);
  return date.toISOString().slice(0, 10);
}

function getDrawingWindow(now: Date): { drawingDate: string; minutesSinceDrawing: number } | null {
  const parts = easternParts(now);
  const weekday = parts.weekday;
  const hour = Number(parts.hour);
  const minute = Number(parts.minute);
  const today = `${parts.year}-${parts.month}-${parts.day}`;
  const drawingWeekday = weekday === 'Mon' || weekday === 'Wed' || weekday === 'Sat';

  // Powerball drawings are at 10:59 p.m. ET. The scheduler starts at about
  // +10 minutes and keeps checking while the Double Play result is pending.
  if (hour >= 23 && drawingWeekday) {
    return { drawingDate: today, minutesSinceDrawing: hour * 60 + minute - (22 * 60 + 59) };
  }

  // Continue the same drawing's retry window after midnight.
  if (hour < 3) {
    const previousDate = previousCalendarDate(today);
    const previousWeekday = new Date(`${previousDate}T12:00:00Z`).getUTCDay();
    const wasDrawingDay = previousWeekday === 1 || previousWeekday === 3 || previousWeekday === 6;
    if (wasDrawingDay) {
      return { drawingDate: previousDate, minutesSinceDrawing: (24 * 60 + hour * 60 + minute) - (22 * 60 + 59) };
    }
  }

  return null;
}

async function run(): Promise<void> {
  const window = getDrawingWindow(new Date());
  if (!window || window.minutesSinceDrawing < 10 || window.minutesSinceDrawing > 180) {
    console.log('Outside the drawing synchronization window; no API call needed.');
    return;
  }

  const existing = await pool.query<{ drawing_type: 'regular' | 'double_play' }>(
    `SELECT drawing_type
       FROM drawings
      WHERE drawing_date = $1
        AND drawing_type IN ('regular', 'double_play')`,
    [window.drawingDate]
  );

  const hasRegular = existing.rows.some(row => row.drawing_type === 'regular');
  const hasDoublePlay = existing.rows.some(row => row.drawing_type === 'double_play');

  if (hasRegular && hasDoublePlay) {
    console.log(`Drawing ${window.drawingDate} is complete; no API call needed.`);
    return;
  }

  const missing = [
    !hasRegular ? 'regular drawing' : null,
    !hasDoublePlay ? 'Double Play' : null
  ].filter(Boolean).join(' and ');
  console.log(`Drawing ${window.drawingDate} is missing ${missing}; checking provider.`);

  const response = await fetch(syncUrl, {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'X-Drawing-Ingest-Token': ingestToken
    }
  });

  const text = await response.text();
  if (!response.ok) {
    throw new Error(`Drawing sync endpoint returned HTTP ${response.status}: ${text}`);
  }

  console.log(`Drawing sync completed: ${text}`);
}

try {
  await run();
} finally {
  await pool.end();
}
