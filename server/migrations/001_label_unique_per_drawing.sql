-- Change ticket-label uniqueness from per-user to per-user/per-drawing-date.
-- Run this migration against an existing database created from an earlier schema.

ALTER TABLE tickets
  DROP CONSTRAINT IF EXISTS tickets_user_id_normalized_label_key;

CREATE UNIQUE INDEX IF NOT EXISTS tickets_user_date_label_unique_idx
  ON tickets (user_id, drawing_date, normalized_label);
