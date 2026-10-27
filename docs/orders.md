# Table ordering

Guests choose **Order now** beside **Explore the menu** on the homepage, or visit `/order`. After guest login/name selection, they select their actual table, add dishes and quantities, review the menu estimate and submit. Orders use the server-authenticated guest number and chosen profile name; the browser cannot choose someone else's name, price or identity. The customer can follow Received, Preparing, Ready, Served or Cancelled on the same page.

The owner has separate Reservations and Orders tabs. `/admin/orders` polls every three seconds while visible and lists active orders in ascending queue-number order, including those received before midnight. The tab badge updates every five seconds, including while viewing Reservations. Daily history uses Asia/Seoul dates and includes completed/cancelled orders. The owner can download all retained orders through the authenticated text download.

## Queue and data integrity

- A configuration-row transaction lock serializes new order insertion and queue-number assignment across application instances. Queue numbers reflect committed receipt order and may contain gaps after rolled-back transactions. Owner actions must start the oldest waiting order first. Preparing orders can proceed concurrently; the owner marks dishes ready and served when they actually are. Queue order does not promise identical cooking times.
- Each submission has a random idempotency key bound to the authenticated guest, table and normalized item quantities. Retrying a request returns the original order. A changed request with the same key is rejected. The browser preserves a pending key in sessionStorage to support uncertain-result retries and clears it after a successful receipt.
- The backend accepts only active configured tables and menu IDs from `src/data/menu.ts`. It calculates the estimate itself and snapshots dish names, quantities, table name and prices into the order. Missing prices remain unknown. The existing menu prices are historical/indicative; staff must confirm current prices and dish availability. This is a dine-in request workflow with a final bill handled at the restaurant, not a payment processor or inventory/POS integration. Staff can cancel an unavailable order.
- When the owner marks an order served, the same database transaction creates one immutable internal meal receipt snapshot with a receipt number, table, guest, item quantities/prices and Seoul serving time. The owner can print it from the order history. Each served order gets its own receipt; multiple orders from one table remain separate records. Serving time is the recorded status-change time, and estimates are not proof of payment or a tax invoice.
- Ordering checks the current operating hours and closures in Asia/Seoul. It is independent of owner online status and the reservation booking toggle. The owner-confirmed local hours are 24/7. A table selection identifies where the customer says they are seated; it does not reserve seats or verify physical presence.
- Only authenticated guests can submit/read their own orders. Only authenticated owners/authorized staff can view the full queue or change order statuses. Status transitions and versions are checked server-side; concurrent staff updates cannot silently overwrite one another. Origin checks, strict Zod validation, JSON body limits, hashed-IP/session rate limits and existing owner authentication apply. Limits accommodate customers sharing the restaurant Wi-Fi while keeping owner-password attempts separately restricted.
- New orders have a maximum of 30 distinct dishes, 20 portions per dish and 60 portions total. Active and history lists show up to 500 orders with an explicit overflow notice; the text download includes all retained orders. Guests see their latest 50 retained orders.

## Database and deployment

Run `npm run db:migrate` before deploying the new application. Migration `005_table_orders.sql` creates `booking.dining_orders`; migration `006_order_receipts.sql` creates private receipt records and backfills currently retained served orders. The existing table/hour configuration is reused. Orders remain in PostgreSQL when the owner is offline or a browser closes.

No extra external account is needed beyond the existing PostgreSQL/owner authentication setup. Use HTTPS and the existing trusted reverse-proxy/IP configuration in production. Polling works on the existing Next.js Node server without opening the private database to browser clients. Ensure owners keep the dashboard visible to monitor incoming orders; this implementation does not send an audible/background push notification.

## Private text records and retention

`orders.txt` in the project root contains:

`Year | Month | Day | Received time | Queue number | Table | Guest number | Customer name | Ordered items | Status | Estimated KRW | Reference | Guest numbering date`

Guest display numbers restart at 1 each day at midnight in Asia/Seoul. Permanent internal identities continue to isolate order access, retries and profile changes. Migration `016_daily_guest_numbers.sql` must be applied before running this version; existing records keep their original numbers. The guest numbering date identifies which day's Guest 1 made a reservation or order, even if the reservation date or meal serving date is later.

`history.txt` combines the retained dated orders, reservations and served receipts, including guest names, numbers and item quantities. It refreshes with the existing private exports and can be downloaded using **Download guest history (.txt)** on the owner Orders page (`GET /api/admin/history`). Set `HISTORY_RECORDS_PATH` to override its private location. Edge deployments store the same snapshot in `booking.records_export.history_text`. A daily reset never clears history; the existing retention and deletion policy still applies.

`receipts.txt` contains one private record per order marked served, including the serving time, table/customer, item snapshot, receipt number and estimated amount. It is an internal order record, not proof that a bill was paid or a tax invoice.

It is separate from `reservations.txt`: a walk-in table order does not create a reservation or invent a phone number. Reservation staff-entered order notes remain available. Text snapshots refresh after committed orders, status changes and profile-name changes. Atomic replacement and database locking prevent interleaved file writes. A failed write cannot cancel the committed order; a database dirty marker preserves the retry, and the owner sees a notice. Order creation and queue actions are audited without placing customer names in audit messages.

Set `ORDERS_RECORDS_PATH` and `RECEIPTS_RECORDS_PATH` to optional private persistent `.txt` paths outside `public/` on deployments whose project directory is ephemeral/read-only. All three private record paths must be different and shared across instances. The existing authenticated `POST /api/jobs/records` scheduled every minute rebuilds all three files; `POST /api/jobs/retention` every 15 minutes removes expired orders and receipts and updates the files. Default receipt retention follows the order's configured retention period, currently seven days after receipt. Downloaded copies must follow the same handling policy. The files are current snapshots, not permanent tamper-proof evidence. Default filenames and temporary write files are excluded from Git.

## Endpoints

| Endpoint | Purpose |
| --- | --- |
| `GET /api/orders/catalog` | Guest-only real tables, menu and current service-open state |
| `GET /api/orders` | Authenticated guest's own recent orders |
| `POST /api/orders` | `{tableId, items:[{menuId,quantity}], idempotencyKey, website:""}` |
| `GET /api/admin/orders` | Oldest-first active queue, oldest waiting order ID |
| `GET /api/admin/orders?date=YYYY-MM-DD` | KST daily history |
| `GET /api/admin/orders/count` | Authorized count for the waiting-order badge |
| `PATCH /api/admin/orders/:id` | `{status,version}`; preparing/ready/served/cancelled |
| `GET /api/admin/orders/records` | Authorized no-store text download |
| `GET /api/admin/orders/receipts` | Authorized no-store served-receipt text download |

## Verification

`npm test` covers input limits and spoofed fields. `npm run test:db` uses isolated SQLite for concurrent duplicate submissions, server-side totals, FIFO enforcement, concurrent staff updates, customer isolation, invalid/inactive tables, closed days, unknown menu IDs/prices, status transitions, profile names, private exports and retention. Tests write text files only under `.test-db/`; they never add orders to the restaurant database. Browser verification also used an isolated database to exercise two customer orders, the owner queue, live status updates and duplicate-request retry.
