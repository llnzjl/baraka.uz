# Owner menu editor

The authenticated owner opens `/admin/menu` from the owner navigation to search, add or edit customer-facing dishes. Changes to English/Korean names, descriptions, category, KRW price, active visibility and photo save automatically after a short pause. A hidden dish disappears from the website and ordering catalog; prior orders retain their item snapshots.

Menu rows are stored in `booking.restaurant_menu`. On first access, the existing transcribed menu is inserted only for IDs that do not already exist, so customer edits survive restarts and deployments. Apply migrations with `npm run db:migrate`; migration `007_restaurant_menu.sql` creates the table and private server-role access. Order submission reads current active menu names and prices from the database and snapshots them into each order.

Photo uploads accept JPEG, PNG or WebP originals up to 100 MB and 100 megapixels. The server auto-orients and resizes uploads to at most 2200 × 2200 pixels, converts them to WebP, and stores the optimized image in PostgreSQL; this keeps high-resolution originals from slowing down customer pages. Image bytes are served through a public image endpoint and referenced with a versioned URL so a replacement photo appears after refresh. Other menu fields are public but can only be changed through owner-authenticated, same-origin APIs. The homepage checks for updates every five seconds; the guest ordering page refreshes its catalog at the same interval.

The website still has the photographed menu as the initial catalog. Staff should review each listed price and current availability before accepting orders; the owner editor is the source for subsequent live changes.

The web server, reverse proxy, and deployment platform must allow request bodies of at least 101 MB for multipart form overhead. Some serverless hosts impose a lower hard request-size limit; those hosts cannot accept 100 MB originals through this route without changing the hosting plan or moving uploads to direct object-storage uploads.
