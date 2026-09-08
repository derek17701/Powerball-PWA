-- Store the official Power Play multiplier and provenance for each drawing.

ALTER TABLE drawings
  ADD COLUMN IF NOT EXISTS power_play_multiplier SMALLINT NULL,
  ADD COLUMN IF NOT EXISTS source TEXT NULL,
  ADD COLUMN IF NOT EXISTS source_retrieved_at TIMESTAMPTZ NULL;

ALTER TABLE drawings
  DROP CONSTRAINT IF EXISTS drawings_power_play_multiplier_check;

ALTER TABLE drawings
  ADD CONSTRAINT drawings_power_play_multiplier_check
  CHECK (power_play_multiplier IN (2, 3, 4, 5, 10) OR power_play_multiplier IS NULL);
