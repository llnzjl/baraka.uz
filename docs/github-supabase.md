# GitHub Pages with the live Baraka backend

GitHub Pages serves the existing Next.js customer and owner screens as static files. The screens keep the `/baraka` repository prefix and call the Supabase Edge Function for login, reservations, table orders, menu changes, and private owner downloads. Supabase hosts the PostgreSQL database and API; GitHub Pages alone cannot run those server routes.

## One-time owner setup

1. Create a Supabase project. Choose its region after reviewing where South Korean customer data will be stored and any required transfer disclosures. Keep the database private; do not expose the `booking` schema through the Supabase Data API.
2. Create a runtime PostgreSQL login with only the grants required by the existing `booking_app` role. Use Supabase's transaction pooler for `DATABASE_URL`, TLS enabled, a pool size of one. Use a separate database-owner connection for `MIGRATION_DATABASE_URL`; this is used only by GitHub Actions to apply the numbered files in `db/migrations/` and is never sent to the Edge Function.
3. In Cloudflare Turnstile, create a widget for `llnzjl.github.io`, and save its site key and secret key. Use a reviewed public privacy-policy URL and the restaurant's actual controller/contact details. These values are required before availability can be enabled.
4. In GitHub, open **Settings → Secrets and variables → Actions** for `llnzjl/baraka`.

Add these **repository variables**:

| Name | Value |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Project URL, such as `https://PROJECT_REF.supabase.co` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | The project's publishable/anon key; never the service-role or secret key |
| `NEXT_PUBLIC_TURNSTILE_SITE_KEY` | Turnstile site key for `llnzjl.github.io` |

Add these **repository secrets**:

| Name | Value |
| --- | --- |
| `SUPABASE_ACCESS_TOKEN` | Supabase personal access token used by the deployment action |
| `SUPABASE_PROJECT_ID` | Project reference from the Supabase dashboard URL |
| `DATABASE_URL` | Dedicated least-privilege runtime login using the Supabase transaction pooler and TLS |
| `MIGRATION_DATABASE_URL` | Privileged database connection used only to apply migrations |
| `OWNER_USERNAME` | Owner's initial username |
| `OWNER_PASSWORD_HASH` | Scrypt hash generated with `node scripts/configure-owner.mjs`; never put the raw password here |
| `RATE_LIMIT_SECRET` | Independent random value of at least 32 characters |
| `CRON_SECRET` | Independent random value of at least 32 characters |
| `TURNSTILE_SECRET_KEY` | Turnstile secret key |
| `PRIVACY_CONTROLLER` | Restaurant's actual personal-information controller name |
| `PRIVACY_CONTACT` | Actual customer privacy contact |
| `PRIVACY_POLICY_URL` | Public HTTPS privacy policy URL |

Do not add `SUPABASE_SERVICE_ROLE_KEY`, the database URL, the owner password/hash, or any other private value as a GitHub variable or a `NEXT_PUBLIC_*` value. The workflows write the migration and runtime environments to separate, temporary files with private permissions. The privileged migration connection is excluded from Supabase Edge Function secrets.

After setting these values, run **Actions → Publish GitHub Pages → Run workflow**. Pages can publish the website before Supabase is configured, but login, reservations, and ordering will stay unavailable until the backend is live. On a push that changes the backend or migrations, **Deploy Baraka backend** checks the Edge Function, applies migrations, sets its runtime secrets, then deploys `baraka-api`. If no Supabase credentials are configured, backend deployment is skipped while the API type-check still runs.

The migrations create no sample table, hours, guest, menu edit, reservation, or order. Sign in as the owner at `https://llnzjl.github.io/baraka/admin/reservations`, then configure the real tables, capacity, daily hours (the requested booking window is 10:00 to 00:00 Asia/Seoul), closure dates, and booking limits. Keep booking disabled until the settings reflect the real restaurant. Guest sign-in, menu editing, reservations, table orders, order queue, and receipt downloads are available after the Supabase deployment and owner setup succeed.

The Edge API uses the Supabase injected publishable-key list to verify the public API key. It accepts browser requests only from `https://llnzjl.github.io`; IP rate limits use the last valid address in the gateway's `x-forwarded-for` chain so a caller cannot select a bucket by prepending a forged address. Owner sessions use a random bearer token stored only in browser local storage and send it over HTTPS; the server stores only its digest. Configure the project with appropriate backups and alerting.

Check **Actions** after publishing: `Publish GitHub Pages` must complete for the interface to be updated. `Deploy Baraka backend` must complete for APIs to be live. A successful static build alone does not mean reservations or orders are online. Supabase documents [Edge Function deployment from GitHub Actions](https://supabase.com/docs/guides/functions/deploy), [Edge Function secrets](https://supabase.com/docs/guides/functions/secrets), and [Postgres clients from Edge Functions](https://supabase.com/docs/guides/functions/connect-to-postgres).
