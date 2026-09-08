# Server-side database

The PWA now has a PostgreSQL schema designed for real user accounts and cloud ticket storage.

## Data model

- `users` — one account per user.
- `tickets` — a user can own any number of tickets. Each ticket has a stable UUID and a label that is unique **within that user**.
- `ticket_plays` — one to five plays per ticket. Plays are identified by `ticket_id + play_number`; they do not need separate user-facing IDs.
- `drawings` — regular Powerball and Double Play drawing results are stored separately.

Ticket images are intentionally not stored in this database. The structured, user-reviewed ticket data remains authoritative.

## Setup

1. Provision a PostgreSQL database.
2. Run `schema.sql` against it.
3. Set the server `DATABASE_URL` environment variable to the database connection string.
4. The API layer will use the authenticated user's ID for every ticket operation, so users cannot read or modify another user's tickets.

The browser will continue to use IndexedDB for offline operation. Once authentication and the sync API are connected, IndexedDB will act as the local working copy and PostgreSQL as the cloud copy.

## Important security rule

Do not use a client-supplied user ID as authorization. The eventual API must derive the user ID from the authenticated session/token and enforce ownership on every ticket query and mutation.
