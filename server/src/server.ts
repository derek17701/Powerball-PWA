import { createHmac, randomBytes, scrypt as scryptCallback, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { Pool } from 'pg';

const scrypt = promisify(scryptCallback);
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const port = Number(process.env.PORT ?? 3000);
const jwtSecret = process.env.JWT_SECRET;

if (!process.env.DATABASE_URL || !jwtSecret) {
  console.warn('DATABASE_URL and JWT_SECRET must be set before the server is started.');
}

type Play = { numbers: number[]; powerball: number };
type TicketInput = {
  id: string;
  label: string;
  drawingDate: string;
  plays: Play[];
  powerPlayMultiplier: 2 | 3 | 4 | 5 | 10 | null;
  doublePlay: boolean;
};

function json(res: ServerResponse, status: number, body: unknown): void {
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': process.env.CORS_ORIGIN ?? '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS'
  });
  res.end(JSON.stringify(body));
}

async function body(req: IncomingMessage): Promise<any> {
  let text = '';
  for await (const chunk of req) text += chunk;
  return text ? JSON.parse(text) : {};
}

function base64url(value: Buffer | string): string {
  return Buffer.from(value).toString('base64url');
}

function signToken(userId: string): string {
  const header = base64url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const payload = base64url(JSON.stringify({ sub: userId, exp: Math.floor(Date.now() / 1000) + 60 * 60 * 24 * 30 }));
  const data = `${header}.${payload}`;
  const signature = createHmac('sha256', jwtSecret!).update(data).digest('base64url');
  return `${data}.${signature}`;
}

function userIdFromRequest(req: IncomingMessage): string | null {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) return null;
  const token = header.slice(7);
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  const [headerPart, payloadPart, signature] = parts;
  const expected = createHmac('sha256', jwtSecret ?? '').update(`${headerPart}.${payloadPart}`).digest('base64url');
  if (signature.length !== expected.length || !timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) return null;
  try {
    const payload = JSON.parse(Buffer.from(payloadPart, 'base64url').toString('utf8')) as { sub?: string; exp?: number };
    if (!payload.sub || !payload.exp || payload.exp < Math.floor(Date.now() / 1000)) return null;
    return payload.sub;
  } catch {
    return null;
  }
}

async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const derived = (await scrypt(password, salt, 64)) as Buffer;
  return `${salt.toString('base64url')}.${derived.toString('base64url')}`;
}

async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [saltText, hashText] = stored.split('.');
  if (!saltText || !hashText) return false;
  const salt = Buffer.from(saltText, 'base64url');
  const expected = Buffer.from(hashText, 'base64url');
  const actual = (await scrypt(password, salt, expected.length)) as Buffer;
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

function validPlay(play: Play): boolean {
  return Array.isArray(play.numbers) && play.numbers.length === 5 &&
    new Set(play.numbers).size === 5 && play.numbers.every(n => Number.isInteger(n) && n >= 1 && n <= 69) &&
    Number.isInteger(play.powerball) && play.powerball >= 1 && play.powerball <= 26;
}

function validTicket(ticket: TicketInput): boolean {
  return typeof ticket.id === 'string' && ticket.id.length > 0 &&
    typeof ticket.label === 'string' && ticket.label.trim().length > 0 &&
    /^\d{4}-\d{2}-\d{2}$/.test(ticket.drawingDate) &&
    Array.isArray(ticket.plays) && ticket.plays.length >= 1 && ticket.plays.length <= 5 &&
    ticket.plays.every(validPlay) &&
    (ticket.powerPlayMultiplier === null || [2, 3, 4, 5, 10].includes(ticket.powerPlayMultiplier)) &&
    typeof ticket.doublePlay === 'boolean';
}

async function handle(req: IncomingMessage, res: ServerResponse): Promise<void> {
  if (req.method === 'OPTIONS') return json(res, 204, {});
  const url = new URL(req.url ?? '/', `http://${req.headers.host ?? 'localhost'}`);

  try {
    if (req.method === 'POST' && url.pathname === '/auth/register') {
      const input = await body(req) as { email?: string; password?: string };
      const email = input.email?.trim().toLowerCase();
      if (!email || !input.password || input.password.length < 8) return json(res, 400, { error: 'Email and a password of at least 8 characters are required.' });
      const passwordHash = await hashPassword(input.password);
      const result = await pool.query('INSERT INTO users (email, password_hash) VALUES ($1, $2) RETURNING id, email', [email, passwordHash]);
      return json(res, 201, { token: signToken(result.rows[0].id), user: result.rows[0] });
    }

    if (req.method === 'POST' && url.pathname === '/auth/login') {
      const input = await body(req) as { email?: string; password?: string };
      const email = input.email?.trim().toLowerCase();
      if (!email || !input.password) return json(res, 400, { error: 'Email and password are required.' });
      const result = await pool.query('SELECT id, email, password_hash FROM users WHERE email = $1', [email]);
      const user = result.rows[0];
      if (!user || !(await verifyPassword(input.password, user.password_hash))) return json(res, 401, { error: 'Invalid email or password.' });
      return json(res, 200, { token: signToken(user.id), user: { id: user.id, email: user.email } });
    }

    const userId = userIdFromRequest(req);
    if (!userId) return json(res, 401, { error: 'Authentication required.' });

    if (req.method === 'GET' && url.pathname === '/tickets') {
      const result = await pool.query(`
        SELECT t.id, t.label, t.drawing_date, t.power_play_multiplier, t.double_play,
               COALESCE(json_agg(json_build_object('numbers', p.white_numbers, 'powerball', p.powerball) ORDER BY p.play_number) FILTER (WHERE p.play_number IS NOT NULL), '[]') AS plays
        FROM tickets t LEFT JOIN ticket_plays p ON p.ticket_id = t.id
        WHERE t.user_id = $1 GROUP BY t.id ORDER BY t.drawing_date DESC, t.created_at DESC`, [userId]);
      return json(res, 200, result.rows);
    }

    const ticketId = url.pathname.startsWith('/tickets/') ? url.pathname.slice('/tickets/'.length) : '';

    if ((req.method === 'PUT' || req.method === 'POST') && (url.pathname === '/tickets' || Boolean(ticketId))) {
      const ticket = await body(req) as TicketInput;
      if (!validTicket(ticket)) return json(res, 400, { error: 'Invalid ticket data.' });
      if (ticketId && ticket.id !== ticketId) return json(res, 400, { error: 'Ticket ID mismatch.' });
      const normalized = ticket.label.trim().toLowerCase();

      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        await client.query(`
          INSERT INTO tickets (id, user_id, label, normalized_label, drawing_date, power_play_multiplier, double_play, updated_at)
          VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
          ON CONFLICT (id) DO UPDATE SET label = EXCLUDED.label, normalized_label = EXCLUDED.normalized_label,
            drawing_date = EXCLUDED.drawing_date, power_play_multiplier = EXCLUDED.power_play_multiplier,
            double_play = EXCLUDED.double_play, updated_at = NOW()
          WHERE tickets.user_id = $2`,
          [ticket.id, userId, ticket.label.trim(), normalized, ticket.drawingDate, ticket.powerPlayMultiplier, ticket.doublePlay]);
        await client.query('DELETE FROM ticket_plays WHERE ticket_id = $1 AND ticket_id IN (SELECT id FROM tickets WHERE user_id = $2)', [ticket.id, userId]);
        for (const [index, play] of ticket.plays.entries()) {
          await client.query('INSERT INTO ticket_plays (ticket_id, play_number, white_numbers, powerball) VALUES ($1, $2, $3, $4)', [ticket.id, index + 1, play.numbers, play.powerball]);
        }
        await client.query('COMMIT');
      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      } finally {
        client.release();
      }
      return json(res, 200, { saved: true, id: ticket.id });
    }

    if (req.method === 'DELETE' && ticketId) {
      const result = await pool.query('DELETE FROM tickets WHERE id = $1 AND user_id = $2 RETURNING id', [ticketId, userId]);
      return result.rowCount ? json(res, 200, { deleted: true }) : json(res, 404, { error: 'Ticket not found.' });
    }

    return json(res, 404, { error: 'Not found.' });
  } catch (error: any) {
    if (error?.code === '23505') return json(res, 409, { error: 'That ticket label is already in use for this account.' });
    console.error(error);
    return json(res, 500, { error: 'Server error.' });
  }
}

createServer((req, res) => { void handle(req, res); }).listen(port, () => {
  console.log(`Powerball API listening on port ${port}`);
});
