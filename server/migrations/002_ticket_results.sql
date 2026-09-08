-- Add persisted server-side winner results for regular and Double Play drawings.

CREATE TABLE IF NOT EXISTS ticket_results (
  ticket_id UUID NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
  drawing_id UUID NOT NULL REFERENCES drawings(id) ON DELETE CASCADE,
  drawing_type TEXT NOT NULL CHECK (drawing_type IN ('regular', 'double_play')),
  result JSONB NOT NULL,
  has_winner BOOLEAN NOT NULL,
  total_prize BIGINT NOT NULL DEFAULT 0,
  checked_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (ticket_id, drawing_id)
);

CREATE INDEX IF NOT EXISTS ticket_results_ticket_id_idx ON ticket_results(ticket_id);
CREATE INDEX IF NOT EXISTS ticket_results_winner_idx ON ticket_results(has_winner) WHERE has_winner = TRUE;
