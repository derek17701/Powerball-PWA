# Server-side database and winner processing

The PWA now has a PostgreSQL schema designed for real user accounts, cloud ticket storage, and authoritative server-side winner processing.

## Data model

- `users` — one account per user.
- `tickets` — a user can own any number of tickets. Each ticket has a stable UUID and a label that is unique **within that user and drawing date**.
- `ticket_plays` — one to five plays per ticket. Plays are identified by `ticket_id + play_number`; they do not need separate user-facing IDs.
- `drawings` — regular Powerball and Double Play drawing results are stored separately.
- `ticket_results` — server-calculated results for each ticket/drawing, including winning plays, prize tier, winner status, and known fixed prize amounts.

Ticket images are intentionally not stored in this database. The structured, user-reviewed ticket data remains authoritative.

## Winner processing

`server/src/winner-engine.ts` is the authoritative prize calculation engine. It determines the match count, Powerball match, prize tier, Power Play multiplier, winner status, and fixed prize amount for every play.

The `/drawings` endpoint is protected by `DRAWING_INGEST_TOKEN`. When an authorized drawing result is submitted, the server stores the official numbers and immediately processes all matching tickets. Regular drawings process all tickets for the date; Double Play processes only tickets that selected Double Play.

The client can use `GET /tickets/results?drawingDate=YYYY-MM-DD` to retrieve the server-calculated results for the authenticated user.

The jackpot is intentionally represented as a `jackpot` prize tier with no fixed dollar amount because the advertised jackpot/lump-sum value varies by drawing. Fixed non-jackpot prizes are calculated according to the current Powerball prize chart. Double Play uses its separate fixed prize chart and does not receive Power Play multipliers.

## Setup

1. Provision a PostgreSQL database.
2. Run `schema.sql` against it, or run the migrations in order against an existing database.
3. Set `DATABASE_URL`, `JWT_SECRET`, and a separate `DRAWING_INGEST_TOKEN` environment variable.
4. The API layer derives the user ID from the authenticated token for every ticket operation, so users cannot read or modify another user's tickets.
5. Keep `DRAWING_INGEST_TOKEN` private. It is intended for the trusted drawing-results ingestion job, not the browser.

The browser will continue to use IndexedDB for offline operation. Once authentication and the sync API are connected, IndexedDB will act as the local working copy and PostgreSQL as the cloud copy.

## Important security rules

- Do not use a client-supplied user ID as authorization. The API derives the user ID from the authenticated session/token.
- Do not expose `DRAWING_INGEST_TOKEN` to the PWA.
- Do not allow ordinary users to publish or modify official drawing results.
