# SQLite setup

Use Node 24 or newer. SQLite is built into Node; no database service, Docker, or PostgreSQL startup is needed.

For a new installation, copy `.env.example` to `.env.local`, configure the owner credentials with the existing owner setup script, then run `npm run dev`. `DATABASE_DRIVER=sqlite` selects SQLite. The schema initializes automatically on first database access. No tables, opening hours, guests or reservations are invented. Configure actual capacity and hours in the owner dashboard.

`SQLITE_PATH` defaults to `.baraka-data/restaurant.sqlite`, outside `public/` and ignored by Git. Owner credentials, sessions, menu images, reservations, orders, receipts and rate limits live in this file. Daily guest numbering still uses Asia/Seoul. The app uses transactions and SQLite triggers to prevent overlapping table allocations and conflicting opening intervals. WAL mode permits concurrent readers; writes are serialized, including across Node processes on the same machine.

## Copy an existing PostgreSQL installation

1. Stop the website/API processes that write to the old database. Leave PostgreSQL running during the copy.
2. Keep the existing `DATABASE_URL` (or privileged `MIGRATION_DATABASE_URL`) in `.env.local`. Apply any pending PostgreSQL migrations before copying.
3. Run `npm run db:import-postgres -- --activate`.
4. Start `npm run dev`. The importer sets `DATABASE_DRIVER=sqlite` and `SQLITE_PATH` in `.env.local` only after checking the imported data. Existing passwords and IDs are preserved.

The importer reads a consistent PostgreSQL snapshot, checks table/column compatibility, copies all retained data and sequence positions, validates counts, foreign keys and SQLite integrity, and refuses to overwrite an existing SQLite file. PostgreSQL data is left intact. If repeating a trial import, choose a different `SQLITE_PATH`; never erase the current database to retry. Existing installs with a `DATABASE_URL` and no explicit driver continue using PostgreSQL until migration, so an update does not silently switch them to an empty database.

After cutover, stop the old local PostgreSQL with `node scripts/local-postgres.mjs stop`. It is no longer needed by the local website. Switching back to PostgreSQL later does not copy new SQLite changes back; restore/migrate deliberately to avoid losing changes.

## Run and back up

- `npm run dev`: start the website; SQLite opens automatically.
- `npm run db:migrate`: initialize/check the SQLite schema without starting the website.
- `npm run db:backup`: create a consistent backup under `.baraka-data/backups/`, including committed data still in the WAL. This can run while the website is open.
- `npm run test:db`: run isolated SQLite workflow, persistence, and concurrency tests. No PostgreSQL service needed.
- `npm run test:postgres`: optional tests for the retained hosted PostgreSQL backend.
- `npm run test:sqlite:http`: test owner/guest authentication against a fresh isolated database on port 3100 after building with `NEXT_DIST_DIR=.next-sqlite-build`.

Keep the database directory and backups private. Copy backups to separate storage regularly. To restore, stop the website, preserve the current database and its `-wal`/`-shm` sidecars, then set `SQLITE_PATH` to a restored backup in a new private location before restarting. Do not copy just the live main database file while WAL writes are active.

SQLite removes the separate **database** server. The Next.js website still needs a running Node server. For hosting, use persistent local disk on one host; do not put this file on a network share or an ephemeral/serverless filesystem. GitHub Pages cannot run the API. The existing Deno Deploy setup continues to require `DATABASE_DRIVER=postgres` and PostgreSQL.

## Implementation and validation

`db/sqlite-schema.mjs` defines the native schema and constraints; `db/sqlite.mjs` adapts the application's parameterized queries and result types. Schema version/checksum tracking rejects edits to an already applied schema; future changes require a new versioned migration. SQLite has no PostgreSQL roles, so database file permissions and the existing API authentication enforce access. The two PostgreSQL role tests and its function-renaming fault test run only on PostgreSQL; SQLite tests cover actual owner login, session restoration, and password changes.

Runtime reference: [Node SQLite](https://nodejs.org/download/release/latest-v24.x/docs/api/sqlite.html). Transaction behavior: [SQLite transactions](https://www.sqlite.org/lang_transaction.html) and [WAL](https://www.sqlite.org/wal.html).
