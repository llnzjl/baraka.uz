// SQLite schema version 1. PostgreSQL migrations remain available for hosted APIs.
export const schema = `
CREATE TABLE restaurant_config (
 id INTEGER PRIMARY KEY CHECK(id=1), enabled INTEGER NOT NULL DEFAULT 0 CHECK(enabled IN (0,1)),
 dining_minutes INTEGER NOT NULL DEFAULT 90 CHECK(dining_minutes BETWEEN 15 AND 360),
 slot_minutes INTEGER NOT NULL DEFAULT 30 CHECK(slot_minutes BETWEEN 5 AND 120),
 min_notice_minutes INTEGER NOT NULL DEFAULT 120 CHECK(min_notice_minutes BETWEEN 0 AND 43200),
 advance_days INTEGER NOT NULL DEFAULT 60 CHECK(advance_days BETWEEN 1 AND 365),
 max_party INTEGER NOT NULL DEFAULT 12 CHECK(max_party BETWEEN 1 AND 100),
 max_concurrent_guests INTEGER NOT NULL DEFAULT 40 CHECK(max_concurrent_guests BETWEEN 1 AND 1000),
 daily_booking_limit INTEGER NOT NULL DEFAULT 100 CHECK(daily_booking_limit BETWEEN 1 AND 1000),
 auto_confirm INTEGER NOT NULL DEFAULT 1 CHECK(auto_confirm IN (0,1)),
 retention_days INTEGER NOT NULL DEFAULT 7 CHECK(retention_days BETWEEN 1 AND 90),
 privacy_version TEXT NOT NULL DEFAULT '1', updated_at TEXT NOT NULL DEFAULT (app_now())
);
INSERT INTO restaurant_config(id) VALUES(1);
CREATE TABLE sequences(name TEXT PRIMARY KEY, value INTEGER NOT NULL);
INSERT INTO sequences VALUES('entry_sessions_guest_number_seq',0),('dining_orders_queue_number_seq',0),('order_receipts_receipt_number_seq',0);
CREATE TABLE dining_tables (
 id TEXT PRIMARY KEY NOT NULL DEFAULT (gen_random_uuid()), name TEXT NOT NULL UNIQUE,
 seats INTEGER NOT NULL CHECK(seats BETWEEN 1 AND 100), active INTEGER NOT NULL DEFAULT 1 CHECK(active IN (0,1))
);
CREATE TABLE opening_hours (
 id TEXT PRIMARY KEY NOT NULL DEFAULT (gen_random_uuid()), weekday INTEGER NOT NULL CHECK(weekday BETWEEN 0 AND 6),
 opens INTEGER NOT NULL CHECK(opens BETWEEN 0 AND 1439), closes INTEGER NOT NULL CHECK(closes BETWEEN 1 AND 1440), CHECK(opens<closes)
);
CREATE TABLE closed_dates(date TEXT PRIMARY KEY NOT NULL, reason TEXT NOT NULL DEFAULT 'Closed');
CREATE TABLE reservations (
 id TEXT PRIMARY KEY NOT NULL DEFAULT (gen_random_uuid()), reference TEXT NOT NULL UNIQUE,
 idempotency_key TEXT NOT NULL UNIQUE, request_hash TEXT NOT NULL,
 name TEXT NOT NULL, phone TEXT NOT NULL, email TEXT, notes TEXT NOT NULL DEFAULT '',
 guests INTEGER NOT NULL CHECK(guests BETWEEN 1 AND 100), starts_at TEXT NOT NULL, ends_at TEXT NOT NULL CHECK(ends_at>starts_at),
 status TEXT NOT NULL CHECK(status IN ('pending','confirmed','cancelled','completed','no_show')),
 locale TEXT NOT NULL CHECK(locale IN ('ko','en','uz','ru')), consent_at TEXT NOT NULL DEFAULT (app_now()), optional_consent_at TEXT,
 adult_attested INTEGER NOT NULL DEFAULT 1 CHECK(adult_attested=1), privacy_version TEXT NOT NULL,
 source TEXT NOT NULL CHECK(source IN ('web','admin')), created_by TEXT,
 version INTEGER NOT NULL DEFAULT 1, created_at TEXT NOT NULL DEFAULT (app_now()), updated_at TEXT NOT NULL DEFAULT (app_now()), purge_at TEXT NOT NULL,
 guest_number INTEGER, ordered_items TEXT NOT NULL DEFAULT '' CHECK(length(ordered_items)<=2000), guest_name TEXT NOT NULL DEFAULT '' CHECK(length(guest_name)<=80)
);
CREATE INDEX reservations_start ON reservations(starts_at);
CREATE INDEX reservations_purge ON reservations(purge_at);
CREATE TABLE table_allocations (
 id TEXT PRIMARY KEY NOT NULL DEFAULT (gen_random_uuid()), reservation_id TEXT NOT NULL REFERENCES reservations(id) ON DELETE CASCADE,
 table_id TEXT NOT NULL REFERENCES dining_tables(id), starts_at TEXT NOT NULL, ends_at TEXT NOT NULL CHECK(ends_at>starts_at),
 active INTEGER NOT NULL DEFAULT 1 CHECK(active IN (0,1)), UNIQUE(reservation_id,table_id)
);
CREATE INDEX allocations_overlap ON table_allocations(table_id,starts_at,ends_at) WHERE active=1;
CREATE TABLE notifications (
 id TEXT PRIMARY KEY NOT NULL DEFAULT (gen_random_uuid()), reservation_id TEXT NOT NULL REFERENCES reservations(id) ON DELETE CASCADE,
 event_key TEXT NOT NULL UNIQUE, recipient TEXT NOT NULL, subject TEXT NOT NULL, body TEXT NOT NULL,
 status TEXT NOT NULL DEFAULT 'queued' CHECK(status IN ('queued','sending','sent','failed')),
 attempts INTEGER NOT NULL DEFAULT 0, available_at TEXT NOT NULL DEFAULT (app_now()), locked_until TEXT,
 lease_id TEXT, provider_id TEXT, last_error TEXT, created_at TEXT NOT NULL DEFAULT (app_now()), sent_at TEXT
);
CREATE INDEX notifications_ready ON notifications(status,available_at);
CREATE TABLE admin_users(user_id TEXT PRIMARY KEY NOT NULL, role TEXT NOT NULL CHECK(role IN ('manager','staff')), active INTEGER NOT NULL DEFAULT 1);
CREATE TABLE rate_limits(key TEXT PRIMARY KEY NOT NULL, count INTEGER NOT NULL, expires_at TEXT NOT NULL);
CREATE TABLE entry_sessions (
 id TEXT PRIMARY KEY NOT NULL DEFAULT (gen_random_uuid()), token_hash TEXT NOT NULL UNIQUE,
 kind TEXT NOT NULL CHECK(kind IN ('owner','guest')), guest_number INTEGER, credential_version TEXT,
 created_at TEXT NOT NULL DEFAULT (app_now()), expires_at TEXT NOT NULL, last_seen TEXT NOT NULL DEFAULT (app_now()),
 display_name TEXT NOT NULL DEFAULT '' CHECK(length(display_name)<=80)
);
CREATE INDEX entry_sessions_expiry ON entry_sessions(expires_at);
CREATE INDEX entry_sessions_guest_number_idx ON entry_sessions(guest_number);
CREATE TABLE records_export (
 id INTEGER PRIMARY KEY CHECK(id=1), dirty INTEGER NOT NULL DEFAULT 1, exported_at TEXT,
 reservation_text TEXT NOT NULL DEFAULT '', orders_text TEXT NOT NULL DEFAULT '', receipts_text TEXT NOT NULL DEFAULT '', history_text TEXT
);
INSERT INTO records_export(id) VALUES(1);
CREATE TABLE dining_orders (
 id TEXT PRIMARY KEY NOT NULL DEFAULT (gen_random_uuid()), queue_number INTEGER NOT NULL UNIQUE DEFAULT (nextval('dining_orders_queue_number_seq')),
 reference TEXT NOT NULL UNIQUE, idempotency_key TEXT NOT NULL UNIQUE, request_hash TEXT NOT NULL,
 guest_number INTEGER NOT NULL, guest_name TEXT NOT NULL CHECK(length(guest_name) BETWEEN 1 AND 80),
 table_id TEXT NOT NULL REFERENCES dining_tables(id), table_name TEXT NOT NULL,
 items TEXT NOT NULL CHECK(json_valid(items) AND json_type(items)='array' AND json_array_length(items) BETWEEN 1 AND 30),
 estimated_total INTEGER CHECK(estimated_total>=0), status TEXT NOT NULL DEFAULT 'queued' CHECK(status IN ('queued','preparing','ready','served','cancelled')),
 version INTEGER NOT NULL DEFAULT 1, created_at TEXT NOT NULL DEFAULT (app_now()), updated_at TEXT NOT NULL DEFAULT (app_now()), purge_at TEXT NOT NULL
);
CREATE INDEX dining_orders_queue ON dining_orders(queue_number) WHERE status IN ('queued','preparing','ready');
CREATE INDEX dining_orders_guest ON dining_orders(guest_number,created_at);
CREATE INDEX dining_orders_retention ON dining_orders(purge_at);
CREATE TABLE order_receipts (
 id TEXT PRIMARY KEY NOT NULL DEFAULT (gen_random_uuid()), receipt_number INTEGER NOT NULL UNIQUE DEFAULT (nextval('order_receipts_receipt_number_seq')),
 order_id TEXT NOT NULL UNIQUE REFERENCES dining_orders(id) ON DELETE CASCADE, reference TEXT NOT NULL, table_name TEXT NOT NULL,
 guest_number INTEGER NOT NULL, guest_name TEXT NOT NULL,
 items TEXT NOT NULL CHECK(json_valid(items) AND json_type(items)='array' AND json_array_length(items)>0),
 estimated_total INTEGER CHECK(estimated_total>=0), served_at TEXT NOT NULL, purge_at TEXT NOT NULL
);
CREATE INDEX order_receipts_retention ON order_receipts(purge_at);
CREATE TABLE audit_log (
 id INTEGER PRIMARY KEY AUTOINCREMENT, actor TEXT NOT NULL, action TEXT NOT NULL,
 reservation_id TEXT REFERENCES reservations(id) ON DELETE SET NULL, created_at TEXT NOT NULL DEFAULT (app_now()),
 order_id TEXT REFERENCES dining_orders(id) ON DELETE SET NULL
);
CREATE TABLE restaurant_menu (
 id TEXT PRIMARY KEY NOT NULL CHECK(regexp('^[a-z0-9][a-z0-9-]{0,79}$',id)),
 name TEXT NOT NULL CHECK(length(name) BETWEEN 1 AND 100), name_ko TEXT NOT NULL CHECK(length(name_ko) BETWEEN 1 AND 100),
 category TEXT NOT NULL CHECK(category IN ('mains','grill','soups','bakery','salads','drinks')),
 description TEXT NOT NULL DEFAULT '' CHECK(length(description)<=500), description_ko TEXT NOT NULL DEFAULT '' CHECK(length(description_ko)<=500),
 price INTEGER CHECK(price BETWEEN 0 AND 5000000), active INTEGER NOT NULL DEFAULT 1 CHECK(active IN (0,1)),
 image_data BLOB CHECK(image_data IS NULL OR length(image_data)<=3145728), image_type TEXT CHECK(image_type IS NULL OR image_type IN ('image/jpeg','image/png','image/webp')),
 image_version TEXT, updated_at TEXT NOT NULL DEFAULT (app_now()), CHECK((image_data IS NULL)=(image_type IS NULL))
);
CREATE INDEX restaurant_menu_public ON restaurant_menu(active,category,name);
CREATE TABLE owner_credentials (
 id INTEGER PRIMARY KEY CHECK(id=1), username TEXT NOT NULL CHECK(regexp('^[A-Za-z0-9_.-]{3,100}$',username)),
 password_salt TEXT NOT NULL CHECK(regexp('^[a-f0-9]{64}$',password_salt)), password_hash TEXT NOT NULL CHECK(regexp('^[a-f0-9]{128}$',password_hash)),
 credential_version INTEGER NOT NULL DEFAULT 1 CHECK(credential_version>0), updated_at TEXT NOT NULL DEFAULT (app_now()), owner_name TEXT, owner_phone TEXT, owner_email TEXT
);
CREATE TABLE customer_accounts (
 guest_number INTEGER PRIMARY KEY DEFAULT (nextval('entry_sessions_guest_number_seq')),
 username TEXT NOT NULL UNIQUE CHECK(username=lower(username) AND regexp('^[a-zA-Z0-9_.-]{3,40}$',username)), auth_user_id TEXT UNIQUE,
 display_name TEXT NOT NULL CHECK(length(display_name) BETWEEN 1 AND 80), verified_at TEXT, registration_key_hash TEXT,
 reserved_until TEXT, created_at TEXT NOT NULL DEFAULT (app_now()), CHECK((auth_user_id IS NULL)=(registration_key_hash IS NOT NULL))
);
CREATE TABLE guest_numbers (
 guest_id INTEGER PRIMARY KEY, guest_date TEXT NOT NULL, daily_number INTEGER NOT NULL CHECK(daily_number>0), UNIQUE(guest_date,daily_number)
);
CREATE TRIGGER daily_guest_number AFTER INSERT ON entry_sessions WHEN NEW.kind='guest' AND importing()=0 BEGIN
 INSERT INTO guest_numbers(guest_id,guest_date,daily_number)
 SELECT NEW.guest_number,seoul_date(),COALESCE(max(daily_number),0)+1 FROM guest_numbers WHERE guest_date=seoul_date();
 UPDATE entry_sessions SET expires_at=min(expires_at,seoul_midnight()) WHERE id=NEW.id;
END;
`;

// Database constraints also protect writes that bypass application availability checks.
export const triggers = ["INSERT", "UPDATE"].flatMap(event => [
 `CREATE TRIGGER allocations_no_overlap_${event.toLowerCase()} BEFORE ${event} ON table_allocations
 WHEN NEW.active=1 AND EXISTS(SELECT 1 FROM table_allocations WHERE active=1 AND table_id=NEW.table_id AND id<>NEW.id AND starts_at<NEW.ends_at AND ends_at>NEW.starts_at)
 BEGIN SELECT RAISE(ABORT,'allocation_overlap'); END;`,
 `CREATE TRIGGER hours_no_overlap_${event.toLowerCase()} BEFORE ${event} ON opening_hours
 WHEN EXISTS(SELECT 1 FROM opening_hours WHERE weekday=NEW.weekday AND id<>NEW.id AND opens<NEW.closes AND closes>NEW.opens)
 BEGIN SELECT RAISE(ABORT,'hours_overlap'); END;`,
]).join('\n') + ['reservations','dining_orders','order_receipts'].flatMap(table =>
 ['INSERT','UPDATE','DELETE'].map(event => `CREATE TRIGGER ${table}_dirty_${event.toLowerCase()} AFTER ${event} ON ${table}
 BEGIN UPDATE records_export SET dirty=1 WHERE id=1; END;`)
).join('\n');
