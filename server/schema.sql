-- Powerball PWA server database schema (PostgreSQL)
-- One user can own many tickets. Ticket labels are unique per user, not globally.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS tickets (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  label TEXT NOT NULL,
  normalized_label TEXT NOT NULL,
  drawing_date DATE NOT NULL,
  power_play_multiplier SMALLINT NULL CHECK (power_play_multiplier IN (2, 3, 4, 5, 10)),
  double_play BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, normalized_label)
);

CREATE TABLE IF NOT EXISTS ticket_plays (
  ticket_id UUID NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
  play_number SMALLINT NOT NULL CHECK (play_number BETWEEN 1 AND 5),
  white_numbers SMALLINT[] NOT NULL,
  powerball SMALLINT NOT NULL CHECK (powerball BETWEEN 1 AND 26),
  PRIMARY KEY (ticket_id, play_number),
  CHECK (array_length(white_numbers, 1) = 5)
);

CREATE TABLE IF NOT EXISTS drawings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  drawing_date DATE NOT NULL,
  drawing_type TEXT NOT NULL CHECK (drawing_type IN ('regular', 'double_play')),
  white_numbers SMALLINT[] NOT NULL,
  powerball SMALLINT NOT NULL CHECK (powerball BETWEEN 1 AND 26),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (drawing_date, drawing_type)
);

CREATE INDEX IF NOT EXISTS tickets_user_id_idx ON tickets(user_id);
CREATE INDEX IF NOT EXISTS tickets_drawing_date_idx ON tickets(drawing_date);
CREATE INDEX IF NOT EXISTS drawings_date_idx ON drawings(drawing_date);
