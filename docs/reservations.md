# Reservation system: setup and deployment

The existing Silk Road design now contains a real booking form. `/book-a-table?lang=ko|en|uz|ru` provides a dedicated localized page; the homepage uses the same component. `/admin/reservations` provides staff authentication, a daily calendar/list, guest counts, table assignments, state changes, manual entry, hours, closures, and table/capacity configuration.

No database, hours, tables, credentials, customer records, or successful deliveries are invented. The migration creates **disabled configuration and zero dining tables/hours**. Unconfigured deployments report that online reservations are unavailable. The key shared in chat is not used by this application; revoke that exposed key separately.

## Required owner configuration

1. A Supabase project, preferably with a region chosen after considering Korean data residency and transfer requirements. Obtain its PostgreSQL connection string. Never expose a service-role key or PostgreSQL credentials through `NEXT_PUBLIC_*`.
2. Actual table names/seating capacities, weekly opening intervals, closure dates, dining duration, notice period, booking horizon, guest limits and confirmation policy. Tables are assigned individually using best fit; automatic table combinations are deliberately unsupported.
3. Server-only `OWNER_USERNAME` and `OWNER_PASSWORD_HASH`. The existing owner credentials are configured locally in ignored `.env.local` as a salted scrypt hash. On first owner sign-in after migration `008_owner_credentials.sql`, the username and hash are initialized into the private database credentials table. After migration `012_owner_profile.sql`, `/admin/my-page` lets the signed-in owner change username, display name, phone, and password; profile values are persisted in the private database. Password changes require the current password. Owner account access has no email verification or email reset flow. No password is shipped to the browser. Protect the database and take backups as part of credential recovery planning.
4. Resend API key, verified sending domain/address, and restaurant owner email. Configure SPF/DKIM/DMARC in DNS. This sends email only, not SMS. Email is optional for guests; the on-screen receipt is authoritative.
5. Cloudflare Turnstile site/secret keys restricted to the production hostname. The backend checks the token, hostname and `reservation` action. Only development permits the explicit bot-protection bypass.
6. An HTTPS `APP_ORIGIN`, independent random `RATE_LIMIT_SECRET` and `CRON_SECRET`, and a `TRUSTED_IP_HEADER` that the hosting edge **overwrites**. For Vercel, verify the current `x-vercel-forwarded-for` contract; for another host configure a trusted reverse proxy and prevent direct origin access. Never trust an arbitrary client-supplied forwarding header. Add edge-level IP/WAF limits in addition to the PostgreSQL-backed app limits.
7. The real controller identity, privacy contact and publicly accessible, reviewed privacy policy URL. Explain all processors, purposes, retention periods, regions, international transfers and rights handling. The inline four-language consent text does not substitute for the owner's complete policy.
8. An external scheduler for the two authenticated job endpoints below, and monitoring/alerts for job failures and stale jobs. Configuration being present does not prove a scheduler or email provider is operating.

## Local setup

Use Node 22 or later. Run `npm ci`, merge missing settings from `.env.example` into `.env.local` (preserve any existing credential hash), and fill the relevant values. Secrets belong in the host's secret manager for deployment. Do not commit any populated environment file.

For local development without a Supabase project, run `node scripts/local-database.mjs`. It starts persistent real PostgreSQL on loopback port 55432, adds its connection to ignored `.env.local`, and applies all migrations. Storage is in ignored `.local-db/`. It creates no sample tables, hours, guests, or reservations. Restart it with the same command after reboot; stop with `node scripts/local-database.mjs stop`. Restart Next.js if it has not reloaded the environment. This helper does not replace an existing external connection, and it is not a production database service. Use Supabase and managed backups for deployment.

If `POST /api/session` returns 503, check that `DATABASE_URL` is populated and reachable and that all numbered migrations were applied. Owner password configuration alone is insufficient: numbered guest sessions, owner sessions, and rate limits are stored in PostgreSQL.

Run `npm run db:migrate`. The migration runner uses `MIGRATION_DATABASE_URL` when present, otherwise `DATABASE_URL`. It uses a PostgreSQL advisory lock, a checksum ledger and per-migration transactions. Run migrations with the Supabase database owner/direct or session connection; `btree_gist` extension creation requires appropriate privileges. Do not edit applied migration files; add another numbered migration.

For the runtime, provision a separate login with a strong password via a secure database console, grant it the `booking_app` role, and use that login in `DATABASE_URL`. `booking_app` has access to the private booking schema through RLS policies. Do not grant this role to Supabase `anon` or `authenticated`; do not expose `booking` as a Data API schema. Use verified TLS (`sslmode=verify-full`, appropriate CA) on external PostgreSQL connections. The runtime uses parameterized `pg` queries and no prepared statement names, compatible with Supabase transaction pooling; select pool limits appropriate for your deployment (the app pool is five connections per instance).

Visitors can enter as owner or continue as a guest. Anonymous guest sessions last eight hours, have sequential display numbers and independent random 256-bit cookie tokens. Guest numbers are never authentication credentials. Expired sessions are deleted by the retention job; booking numbers remain with reservations until their normal deletion deadline. Owner account details are available at `/admin/my-page`. Username, display name, and phone can be changed there with the active owner session; changing the password also requires the current password. The current device stays signed in and other owner sessions are invalidated after changes. Reservation email notifications are independent of owner account access.

Owner sessions last eight hours. The dashboard polls reservations every 15 seconds. Online bookings remain available when the owner logs out, closes the dashboard or their session expires. They depend on configured operating hours, tables, capacity, closures and enabled booking settings, not owner presence. Manual owner entry also uses capacity and operating-hour checks.

Cookies are HttpOnly, SameSite=Strict, and Secure in production. Only hashed tokens are stored in PostgreSQL. Passwords use a salted scrypt hash; profile password changes verify the current password and revoke other owner sessions. Owner sessions grant manager access; optional existing Supabase API integrations still require verified MFA and the database allowlist. Guest cookies never grant admin privileges.

Start `npm run dev`, sign in with the owner username/password at `/admin/reservations`, enter actual tables/hours and enable booking. Setup defaults shown when adding an unsaved row must be reviewed before saving; they are not live availability. Safe settings changes are permitted while bookings exist; changes that would remove an allocated table, reduce its capacity, close its period or exceed concurrent capacity are rejected until staff resolve those reservations with guests. Disabling new bookings is allowed without cancelling existing ones. Changes to duration apply only to new reservations; existing time ranges stay intact. Split overnight operating intervals across the two weekdays (closing minute 1440 represents midnight).

## Correctness and lifecycle

All timestamps are PostgreSQL `timestamptz` instants. The business calendar is fixed to `Asia/Seoul`, independent of application, database and browser host timezone. Weekly hours are integer minutes since Korean midnight. Allocations use half-open intervals `[start,end)`, allowing one booking to start exactly when another ends.

The configuration row is locked for writes before reading availability and committing a booking. This serializes booking, cancellation and configuration mutations and enforces room/day limits across application instances. A GiST exclusion constraint on active table/time ranges independently prevents overlapping allocations. Read-only availability uses a shared lock for a coherent snapshot; the POST always rechecks capacity. Lock conflicts/timeouts return a retryable conflict, never a fabricated confirmation.

The browser sends a random UUID idempotency key. The database stores a hash of its normalized request and a unique key. Identical retries return the existing receipt; changing data with the same key is rejected. No public endpoint accepts a booking ID to retrieve private customer details. A booking reference alone is not an authentication credential.

`pending` and `confirmed` consume capacity. Pending bookings stay allocated until a staff decision: they do **not** silently expire. `pending → confirmed/cancelled`; `confirmed → cancelled/completed/no_show`. Completed/no-show may be applied only after the scheduled end. Cancellation releases allocations in the same transaction. Optimistic version checks prevent staff overwriting one another. Cancelled/completed/no-show records cannot be reactivated; create a fresh booking after checking availability.

## API

All responses containing reservation data use `Cache-Control: no-store, private`. Admin endpoints accept the authenticated owner cookie (or an allowlisted Supabase MFA bearer token); write endpoints also require an exact `Origin` match and JSON content type. Requests have a 32 KiB limit and Zod validation. SQL errors, credentials and customer information are not returned in error messages or logged.

| Endpoint | Purpose |
| --- | --- |
| `GET /api/reservations/availability?date=YYYY-MM-DD&guests=2` | Current slots, public privacy/config limits; no customer data |
| `GET/POST/PATCH/DELETE /api/session` | Session status, guest/owner login, guest profile name, logout |
| `POST /api/reservations` | Authenticated guest/owner session; validated, bot-checked, idempotent booking |
| `GET /api/admin/reservations?date=YYYY-MM-DD` | Authorized daily list |
| `POST /api/admin/reservations` | Staff manual entry using the same capacity engine and consent checks |
| `PATCH /api/admin/reservations/:id` | `{status, version}` or `{orderedItems, version}`; audited updates |
| `GET /api/admin/reservations/records` | Authorized private text download |
| `POST /api/jobs/records` | Retry/rebuild private text file |
| `GET/PATCH /api/admin/config` | Manager-only settings |
| `POST /api/jobs/notifications` | Disabled; returns without sending email |
| `POST /api/jobs/retention` | Delete expired records and expired rate limits |

Booking body: `date`, `time` (`HH:MM`), integer `guests`, `name`, Korean `phone` (010 or +82 10 format), optional `email`/`notes`, `locale`, `consent:true`, `adult:true`, `optionalConsent` (required if optional data is supplied), current `privacyVersion`, UUID `idempotencyKey`, empty honeypot `website`, and `botToken`. Status, table IDs, prices and internal fields are not accepted from public callers.

## Owner dashboard and scheduled jobs

Reservations and table orders are committed to PostgreSQL and shown in the owner dashboard. Email delivery is disabled and is not part of successful booking or order handling.

Schedule POST `/api/jobs/records` every minute and POST `/api/jobs/retention` every 15 minutes, with `Authorization: Bearer <CRON_SECRET>`. Use a scheduler supporting authenticated POSTs (e.g. Supabase scheduled HTTP calls with secrets stored in its vault); the endpoints do not accept unauthenticated GETs. Scheduler credentials must not appear in source control or URLs. The notifications endpoint is inactive and needs no schedule.

## Privacy operations

The default seven-day retention is an **application setting, not a claim about a Korean statutory retention period**. The owner must choose and justify the shortest period needed for the disclosed booking purpose (1–90 days supported), and publish it before accepting reservations. Each booking captures the notice version, required consent timestamp, optional consent timestamp when applicable, and the 14+ attestation. No payment, identity-document, birth-date, marketing subscription or religious preference is collected. Free-text input explicitly discourages sensitive data. Under-14 online booking is not supported; guardian handling needs a separate reviewed process.

The retention worker permanently deletes expired reservation records and cascades through allocations and notification recipients/bodies. Set `purge_at` to the justified deadline; shortening a policy does not automatically shorten existing rows, so update outstanding deadlines through a reviewed data migration. Audit events lose the reservation link on deletion and expire after 90 days; rate-limit IP/phone keys are HMACs and expire after their windows. Revisit audit retention against your applicable security-log obligations. Production staff, database backups, logs, and exports must also be covered by the owner's policy.

Handle verified access/correction/deletion requests at `PRIVACY_CONTACT`. To erase a guest's record, verify identity off-platform, cancel an active booking if necessary, then delete the reservation through a privileged, audited operator process; cascading deletion removes its allocations and notification data. Do not keep ad-hoc CSV exports. Document a lawful basis for any legally necessary exception before collecting data; this implementation does not introduce indefinite legal holds.

Have the owner/privacy adviser review collection notices, processor contracts, overseas-transfer disclosures/basis, any separately required consent, incident response and rights procedures before launch. A Supabase project and Resend account alone do not establish compliance. Relevant official references: [PIPC guidance on PIPA, rights, notices and international transfers](https://pipc.go.kr/eng/user/ltn/new/noticeDetail.do?bbsId=BBSMSTR_000000000001&nttId=2488), [PIPA Article 21 destruction requirement](https://law.go.kr/LSW/lsLinkCommonInfo.do?ancYnChk=&chrClsCd=010202&lsJoLnkSeq=1020398651). These are implementation considerations, not a legal certification.

## Verification and deployment

`npm test` covers pure availability, full capacity, closures, limits, invalid inputs, Korean mobile normalization and Seoul midnight handling. `npm run test:db` launches a real, disposable PostgreSQL instance on loopback port 55439 and tests the migration, exclusion constraint, twenty concurrent booking requests, idempotency, cancellation, lifecycle, notifications and retention. Test data is isolated in an ignored `.test-db` directory and never seeded into production. Alternatively use `npm run test:integration` with a disposable database named with suffix `_test`, `TEST_DATABASE_URL`, and `ALLOW_TEST_DB_RESET=true` in `.env.test.local`; it drops that database's booking schema. Never use the production URL. The test harness leaves its stopped cluster files for inspection.

Run `npx tsc --noEmit --incremental false`, `npm run build`, and `npm audit --omit=dev`. Next.js was updated from 13.4.12 to the patched 15.5.28 line; unused vulnerable Swiper/Moment dependencies were removed, and PostCSS is pinned through an override to the installed patched version. Continue dependency monitoring. Build-tool-only advisories may remain; never run builds on untrusted source/CSS/globs.

For the GitHub-only deployment, publish the static Next.js frontend with `.github/workflows/pages.yml` and run its API in Supabase Edge Functions with `.github/workflows/supabase.yml`; see [GitHub Pages with the live Baraka backend](github-supabase.md). The migration is applied before the Edge Function is deployed. Configure the real owner credentials, Turnstile and privacy settings, then enter the actual operating hours and tables while bookings remain disabled. Verify missing credentials fail closed, unauthorized admin access is denied, concurrent requests cannot double book, and scheduled retention/export jobs complete.

Live Supabase PostgreSQL and Turnstile require real configured accounts and cannot be verified until the repository variables/secrets and owner configuration are set. Email delivery is disabled. Do not describe the deployment as accepting reservations until the backend workflow, owner login, Turnstile, real business settings and privacy review are complete.


## Private reservation text file and ordered items

`reservations.txt` in the project root is a UTF-8 current-record export with these columns:

`Year | Month | Day | Time (KST) | Guest number | Customer name | Phone number | Ordered items | Booking reference | Status | Party size`

All dates/times are the reservation's scheduled arrival in Asia/Seoul. Guests' sequential numbers are included; older/manual reservations without a guest session show `Manual` and their unique reference. The file contains actual bookings only. `Not recorded` means staff have not yet entered the food order; it does not mean nothing was ordered. In `/admin/reservations`, enter dishes/quantities under **What they ordered** and click **Save order**. Version checks prevent overwriting someone else's changes. Orders are staff-entered records, not an automatic POS integration.

Bookings, cancellations and order edits commit to PostgreSQL first, then atomically refresh the text file. Concurrent writers are serialized using a database row lock. A database trigger marks the export dirty, so a failed file write remains retryable without losing the booking. The dashboard retries pending exports and displays a notice when the file cannot be written. Schedule authenticated POST `/api/jobs/records` every minute to retry exports even with no owner online. The admin download reads the current database directly, with authentication, auditing and no-store headers.

The file is outside `public/`, excluded from Git, and is not available at a public website URL. It contains customer phone numbers: restrict filesystem access and do not move it into public assets. Newlines, delimiters and control characters in free text are escaped to keep one record per line. The file is a current snapshot, not a tamper-proof or permanent evidence archive. It follows the same retention/deletion rules as PostgreSQL, currently seven days after the visit by default; the retention job rebuilds it after deletion. Any separately downloaded copies must be handled under the same policy.

For deployment, use a writable persistent volume for this file; optionally set server-only `RESERVATION_RECORDS_PATH` to a private `.txt` path outside `public/`. A serverless/ephemeral project directory cannot provide durable text storage. All instances must share the same file location; otherwise use the authenticated download and provision one dedicated export worker with persistent storage. Add any custom private path to your ignore/backups policy. Never include test data in the restaurant's file: integration tests write to isolated `.test-db/records-*.txt` paths and remove their exports afterwards.


## Guest profile names

After Continue as guest, `/guest/profile` lets the customer keep `Guest <number>` or choose a custom name (1-80 characters). The session bar links to Edit name for later changes. The name pre-fills the reservation contact-name field; staff can still distinguish the guest profile name from a different reservation contact name. Guest numbers never change and are not authentication credentials.

`PATCH /api/session` accepts only `{displayName}` and uses the authenticated guest cookie; no client-supplied guest number or account ID can select another account. Owner sessions cannot edit a guest profile through this endpoint. Same-origin protection, validation and rate limits apply. Name changes update that guest's retained reservations and refresh the text file. Customer names are stored separately on reservation records so they remain available after the eight-hour session expires, until the reservation retention deadline. Profile names alone do not create fake reservation rows in the text file.


Owner-confirmed local hours: open 24 hours on all seven weekdays, with zero minimum advance notice (updated 2026-10-24). Starts are offered every 30 minutes, including 23:30 across midnight where the following day is open. Past starts and sold-out slots are excluded. The owner can change hours/notice later in Hours & capacity.


Table orders use the same guest profiles, staff authentication, private export worker and retention job. See [Table ordering](orders.md). Changing a guest name updates their retained table orders as well as reservations. The records job writes `reservations.txt`, `orders.txt` and served-meal `receipts.txt`; configure a persistent, private destination for each.
