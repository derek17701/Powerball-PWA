# Server-side database and winner processing

The PWA now has a PostgreSQL schema designed for real user accounts, cloud ticket storage, and authoritative server-side winner processing.

## Data model

- `users` — one account per user.
- `tickets` — a user can own any number of tickets. Each ticket has a stable UUID and a label that is unique **within that user and drawing date**.
- `ticket_plays` — one to five plays per ticket. Plays are identified by `ticket_id + play_number`; they do not need separate user-facing IDs.
- `drawings` — regular Powerball and Double Play drawing results are stored separately, including the official Power Play multiplier for regular drawings and source metadata.
- `ticket_results` — server-calculated results for each ticket/drawing, including winning plays, prize tier, winner status, and known fixed prize amounts.

Ticket images are intentionally not stored in this database. The structured, user-reviewed ticket data remains authoritative.

## Official drawing-results provider

`server/src/drawing-provider.ts` reads the New York Open Data Powerball dataset supplied by the New York State Gaming Commission:

`https://data.ny.gov/resource/d6yy-54nr.json?$order=draw_date%20DESC&$limit=1`

The provider reads:

- `draw_date` — drawing date.
- `winning_numbers` — five white balls followed by the Powerball.
- `multiplier` — the official Power Play multiplier drawn for that drawing.
- `double_play_winning_numbers` — Double Play's separate five white balls followed by its Powerball, when the result has been published.

The provider is deliberately isolated behind a small adapter so the results source can be changed later without rewriting the winner engine.

## Drawing processing and automatic retries

`POST /drawings/sync-latest` is protected by `DRAWING_INGEST_TOKEN` and retrieves the latest provider record. It immediately processes the regular drawing and processes Double Play only when `double_play_winning_numbers` is present.

`server/src/drawing-sync.ts` is the trusted scheduler client. It is designed to run every five minutes, but it only calls the drawing API during the post-drawing window. Powerball drawings are held Monday, Wednesday, and Saturday at 10:59 p.m. ET. The first scheduled opportunity is therefore about +10 minutes after the drawing, followed by five-minute retries only while the database is missing the regular result or Double Play result.

The scheduler first checks PostgreSQL. If both the regular and Double Play records already exist for that drawing date, it makes **no provider API call**. If either result is missing, it calls `/drawings/sync-latest`. If the provider has not published the missing result yet, the job exits and the next scheduled run retries automatically. Once both results exist, subsequent scheduled runs skip the API call entirely.

The retry window currently extends through three hours after the drawing so a delayed provider publication does not require manual intervention. The database upsert and ticket-result upsert paths are idempotent, so repeated checks cannot create duplicate drawing records or duplicate ticket results.

For Render, configure a cron job to run `npm run sync-drawings` on a five-minute schedule. Render cron expressions use UTC, so the application performs the Powerball schedule and Eastern Time window check itself rather than hard-coding a DST-sensitive UTC schedule. Set `DATABASE_URL`, `DRAWING_SYNC_URL`, and `DRAWING_INGEST_TOKEN` on the cron service. Render cron jobs are isolated scheduled services and guarantee that no two runs of the same cron job are active at once.

`POST /drawings` remains available for trusted/manual ingestion and uses the same server-side processing path.

## Winner processing

`server/src/winner-engine.ts` is the authoritative prize calculation engine. A ticket only indicates whether Power Play was purchased. The **official multiplier from the drawing** determines the Power Play payout; the multiplier selected/stored with a ticket is not used as the payout multiplier. Double Play ignores Power Play entirely.

The server processes regular drawings for all tickets on the drawing date and Double Play only for tickets that selected Double Play.

The client can use `GET /tickets/results?drawingDate=YYYY-MM-DD` to retrieve the server-calculated results for the authenticated user.

The jackpot is intentionally represented as a `jackpot` prize tier with no fixed dollar amount because the advertised jackpot/lump-sum value varies by drawing. Fixed non-jackpot prizes are calculated according to the current Powerball prize chart. Double Play uses its separate fixed prize chart and does not receive Power Play multipliers.

## Setup

1. Provision a PostgreSQL database.
2. Run `schema.sql` against a new database, or run the migrations in order against an existing database.
3. Set `DATABASE_URL`, `JWT_SECRET`, and a separate `DRAWING_INGEST_TOKEN` environment variable.
4. For the automatic drawing scheduler, set `DRAWING_SYNC_URL` to the deployed API's `/drawings/sync-latest` endpoint and give the scheduler the same `DRAWING_INGEST_TOKEN`.
5. Configure a Render cron job with `npm run sync-drawings` and a five-minute cron schedule. The scheduler itself decides whether a provider call is actually necessary.
6. The API layer derives the user ID from the authenticated token for every ticket operation, so users cannot read or modify another user's tickets.
7. Keep `DRAWING_INGEST_TOKEN` private. It is intended for the trusted drawing-results ingestion job, not the browser.

The browser will continue to use IndexedDB for offline operation. Once authentication and the sync API are connected, IndexedDB will act as the local working copy and PostgreSQL as the cloud copy.

## Important security rules

- Do not use a client-supplied user ID as authorization. The API derives the user ID from the authenticated session/token.
- Do not expose `DRAWING_INGEST_TOKEN` to the PWA.
- Do not allow ordinary users to publish or modify official drawing results.
- Treat the NY Open Data result as the configured provider input; the server remains the authoritative source for the results it has accepted and processed.
