# Powerball PWA

Responsive Progressive Web App for tracking Powerball tickets.

## Current features

- Add Powerball tickets manually.
- Require a unique ticket label for each drawing date.
- Store five white-ball numbers and one Powerball number.
- Record the drawing date.
- Mark a ticket for Double Play.
- Delete tickets.
- Browser-local fallback when the server is not configured.
- Supabase authentication and server-side ticket storage.
- Row Level Security so users can only access their own tickets.
- Installable/offline-capable PWA foundation.

## Server-side database

The application is designed to use Supabase Auth + PostgreSQL. The database schema is in `supabase/schema.sql`.

### Setup

1. Create a Supabase project.
2. In the Supabase SQL Editor, run `supabase/schema.sql`.
3. Copy `lib/config.js` to a secure local working copy if desired, then set `SUPABASE_URL` and `SUPABASE_ANON_KEY` to the project's browser URL and publishable/anon key.
4. Do **not** put a Supabase service-role key in the PWA.
5. Serve the PWA from a web server (not `file://`) and test account creation, sign-in, ticket creation, and deletion.

The `tickets` table uses `(user_id, drawing_date, label)` as its unique key. This means a user can reuse a label on a different drawing date, while the same label cannot be duplicated for that user's tickets on the same drawing date.

## Ticket data model

Each server ticket contains:

- `id` — server-generated UUID.
- `user_id` — authenticated Supabase user.
- `drawing_date` — Powerball drawing date.
- `label` — user-assigned physical-ticket identifier.
- `numbers` — five white-ball numbers.
- `powerball` — Powerball number.
- `double_play` — whether Double Play applies.
- `created_at` / `updated_at` — audit timestamps.

## Planned features

- Camera ticket scanning and OCR.
- Support for dozens or hundreds of tickets.
- Automatic drawing/result retrieval.
- Winner checking and clear winning-ticket identification by unique label.
- Double Play result checking.
- Ticket history and drawing results.
