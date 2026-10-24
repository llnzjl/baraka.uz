# GitHub Pages with Deno Deploy and PostgreSQL

The website stays on GitHub Pages at `https://llnzjl.github.io/baraka/`. Its API runs separately from `backend/index.ts` on Deno Deploy and stores reservations, orders, owner sessions, menu edits and exports in PostgreSQL.

## One-time hosting setup

1. Create a free PostgreSQL database with a provider that supports the `btree_gist` extension (for example, Neon Free). Choose its region after considering Korean privacy and data-transfer requirements. Keep the database private and get its privileged migration connection string. Put it in ignored local `.env.local` as `MIGRATION_DATABASE_URL`, then run `npm run db:migrate` once to create the schema and `booking_app` role. Create a separate database login granted only to `booking_app`, and configure TLS for both connections.
2. Sign in to Deno Deploy and create an app from the `llnzjl/baraka` GitHub repository, with the app directory set to the repository root. Allow it to access the private repository. The root `deno.json` selects `backend/index.ts` as the API entrypoint, installs the Node dependencies, and runs `node scripts/migrate.mjs` before each deployment. Deno's pre-deploy step must be able to reach PostgreSQL using the privileged migration URL.
3. In the Deno Deploy app's production environment, add the following values. Mark connection strings, hashes and secrets as secrets. Never put them in GitHub Pages variables or any `NEXT_PUBLIC_*` setting.

| Name | Value |
| --- | --- |
| `DATABASE_URL` | Private PostgreSQL URL for the restricted runtime login |
| `MIGRATION_DATABASE_URL` | Private PostgreSQL owner URL used by the pre-deploy migration command |
| `APP_ORIGIN` | `https://llnzjl.github.io` |
| `OWNER_USERNAME` | Initial owner login name |
| `OWNER_PASSWORD_HASH` | Salted scrypt hash from `node scripts/configure-owner.mjs` |
| `RATE_LIMIT_SECRET` | Independent random secret, at least 32 characters |
| `CRON_SECRET` | Another independent random secret, at least 32 characters; use the same value in the GitHub Actions secret below |
| `TURNSTILE_SECRET_KEY` | Secret key from the Turnstile widget for the Pages hostname |
| `TRUSTED_IP_HEADER` | `x-forwarded-for`, supplied by the hosting proxy |
| `PRIVACY_CONTROLLER`, `PRIVACY_CONTACT`, `PRIVACY_POLICY_URL` | Owner-reviewed public privacy notice information |

The optional Resend variables are unused because email delivery was removed. `OWNER_EMAIL` is not required for login. The database starts with no opening hours, tables, reservations, or orders; configure the real restaurant settings from the owner dashboard before enabling reservations.

4. In the GitHub repository, open **Settings → Secrets and variables → Actions → Variables** and add `NEXT_PUBLIC_API_BASE_URL` with the Deno Deploy production app URL (for example, `https://baraka-api-<your-org>.deno.net`). Add `NEXT_PUBLIC_TURNSTILE_SITE_KEY` with the matching public site key. These are public frontend configuration values, not secrets. In **Secrets**, add `CRON_SECRET` with the exact value configured in Deno Deploy. Do not add a database URL, owner password/hash, Deno token, or Turnstile secret to GitHub.
5. Push to `main` or run **Actions → Publish GitHub Pages → Run workflow**. The Deno Deploy GitHub integration deploys the API separately when its source changes. Check both providers' deployment logs: the Deno deployment must pass migrations and the Pages deployment must build. A successful Pages build alone does not mean the API is available.
6. Open the owner dashboard, configure the real hours, tables, capacity and closures, and complete the privacy setup. Test a guest session, booking, cancellation, order, owner access and retention/export jobs before announcing online booking. The GitHub Actions workflow `Private booking maintenance` retries private exports every five minutes and runs retention every fifteen minutes. GitHub scheduled jobs are best-effort; enable workflow notifications and periodically check its run history.

## Local API

Run PostgreSQL locally using `node scripts/local-database.mjs`, configure private values in ignored `.env.local`, then start the existing Next.js development server with `npm run dev`. Local `/api/...` requests continue to use Next.js route handlers. To exercise the Deno adapter itself, install Deno 2 and run `deno check backend/index.ts`; set the required environment values before running it. `npm test` and `npm run test:db` cover validation and PostgreSQL booking/concurrency behavior.

Deno Deploy's free plan is usage-limited and has no uptime SLA; Neon Free also has resource limits and may suspend compute when idle. Check current provider limits and recovery/backup options before accepting real customer information. Both hosting accounts and their configuration must belong to the restaurant owner.
