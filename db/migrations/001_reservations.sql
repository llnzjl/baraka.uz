CREATE EXTENSION IF NOT EXISTS btree_gist;
SET LOCAL search_path = public, extensions;
CREATE SCHEMA IF NOT EXISTS booking;
REVOKE ALL ON SCHEMA booking FROM PUBLIC;

CREATE TABLE booking.restaurant_config (
 id integer PRIMARY KEY CHECK (id=1), enabled boolean NOT NULL DEFAULT false,
 dining_minutes integer NOT NULL DEFAULT 90 CHECK (dining_minutes BETWEEN 15 AND 360),
 slot_minutes integer NOT NULL DEFAULT 30 CHECK (slot_minutes BETWEEN 5 AND 120),
 min_notice_minutes integer NOT NULL DEFAULT 120 CHECK (min_notice_minutes BETWEEN 0 AND 43200),
 advance_days integer NOT NULL DEFAULT 60 CHECK (advance_days BETWEEN 1 AND 365),
 max_party integer NOT NULL DEFAULT 12 CHECK (max_party BETWEEN 1 AND 100),
 max_concurrent_guests integer NOT NULL DEFAULT 40 CHECK (max_concurrent_guests BETWEEN 1 AND 1000),
 daily_booking_limit integer NOT NULL DEFAULT 100 CHECK (daily_booking_limit BETWEEN 1 AND 1000),
 auto_confirm boolean NOT NULL DEFAULT true,
 retention_days integer NOT NULL DEFAULT 7 CHECK (retention_days BETWEEN 1 AND 90),
 privacy_version text NOT NULL DEFAULT '1', updated_at timestamptz NOT NULL DEFAULT now()
);
INSERT INTO booking.restaurant_config(id) VALUES(1);
CREATE TABLE booking.dining_tables (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), name text NOT NULL UNIQUE,
 seats integer NOT NULL CHECK (seats BETWEEN 1 AND 100), active boolean NOT NULL DEFAULT true
);
CREATE TABLE booking.opening_hours (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), weekday integer NOT NULL CHECK (weekday BETWEEN 0 AND 6),
 opens integer NOT NULL CHECK (opens BETWEEN 0 AND 1439), closes integer NOT NULL CHECK (closes BETWEEN 1 AND 1440),
 CHECK(opens<closes), EXCLUDE USING gist (weekday WITH =, int4range(opens,closes,'[)') WITH &&)
);
CREATE TABLE booking.closed_dates (date date PRIMARY KEY, reason text NOT NULL DEFAULT 'Closed');
CREATE TABLE booking.reservations (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), reference text NOT NULL UNIQUE,
 idempotency_key uuid NOT NULL UNIQUE, request_hash text NOT NULL,
 name text NOT NULL, phone text NOT NULL, email text, notes text NOT NULL DEFAULT '',
 guests integer NOT NULL CHECK(guests BETWEEN 1 AND 100),
 starts_at timestamptz NOT NULL, ends_at timestamptz NOT NULL CHECK(ends_at>starts_at),
 status text NOT NULL CHECK(status IN ('pending','confirmed','cancelled','completed','no_show')),
 locale text NOT NULL CHECK(locale IN ('ko','en','uz','ru')),
 consent_at timestamptz NOT NULL DEFAULT now(), optional_consent_at timestamptz, adult_attested boolean NOT NULL DEFAULT true CHECK(adult_attested), privacy_version text NOT NULL,
 source text NOT NULL CHECK(source IN ('web','admin')), created_by uuid,
 version integer NOT NULL DEFAULT 1, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
 purge_at timestamptz NOT NULL
);
CREATE INDEX reservations_start ON booking.reservations(starts_at);
CREATE INDEX reservations_purge ON booking.reservations(purge_at);
CREATE TABLE booking.table_allocations (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), reservation_id uuid NOT NULL REFERENCES booking.reservations(id) ON DELETE CASCADE,
 table_id uuid NOT NULL REFERENCES booking.dining_tables(id),
 starts_at timestamptz NOT NULL, ends_at timestamptz NOT NULL CHECK(ends_at>starts_at), active boolean NOT NULL DEFAULT true,
 UNIQUE(reservation_id,table_id),
 CONSTRAINT no_overlapping_tables EXCLUDE USING gist (table_id WITH =, tstzrange(starts_at,ends_at,'[)') WITH &&) WHERE(active)
);
CREATE TABLE booking.notifications (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), reservation_id uuid NOT NULL REFERENCES booking.reservations(id) ON DELETE CASCADE,
 event_key text NOT NULL UNIQUE, recipient text NOT NULL, subject text NOT NULL, body text NOT NULL,
 status text NOT NULL DEFAULT 'queued' CHECK(status IN ('queued','sending','sent','failed')),
 attempts integer NOT NULL DEFAULT 0, available_at timestamptz NOT NULL DEFAULT now(), locked_until timestamptz,
 lease_id uuid, provider_id text, last_error text, created_at timestamptz NOT NULL DEFAULT now(), sent_at timestamptz
);
CREATE INDEX notifications_ready ON booking.notifications(status,available_at);
CREATE TABLE booking.admin_users (user_id uuid PRIMARY KEY, role text NOT NULL CHECK(role IN ('manager','staff')), active boolean NOT NULL DEFAULT true);
CREATE TABLE booking.audit_log (
 id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY, actor uuid NOT NULL, action text NOT NULL,
 reservation_id uuid REFERENCES booking.reservations(id) ON DELETE SET NULL, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE booking.rate_limits (key text PRIMARY KEY, count integer NOT NULL, expires_at timestamptz NOT NULL);

-- No browser role can access customer data, even through the Supabase Data API.
DO $$ DECLARE r text; t record; BEGIN
 FOR t IN SELECT tablename FROM pg_tables WHERE schemaname='booking' LOOP
  EXECUTE format('ALTER TABLE booking.%I ENABLE ROW LEVEL SECURITY',t.tablename);
 END LOOP;
 FOREACH r IN ARRAY ARRAY['anon','authenticated'] LOOP
  IF EXISTS(SELECT 1 FROM pg_roles WHERE rolname=r) THEN
   EXECUTE format('REVOKE ALL ON SCHEMA booking FROM %I',r);
   EXECUTE format('REVOKE ALL ON ALL TABLES IN SCHEMA booking FROM %I',r);
  END IF;
 END LOOP;
END $$;

-- A dedicated server login can inherit this role; never grant it to anon/authenticated.
DO $$ BEGIN IF NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname='booking_app') THEN CREATE ROLE booking_app NOLOGIN; END IF; END $$;
GRANT USAGE ON SCHEMA booking TO booking_app;
GRANT SELECT,INSERT,UPDATE,DELETE ON ALL TABLES IN SCHEMA booking TO booking_app;
REVOKE INSERT,UPDATE,DELETE ON booking.admin_users FROM booking_app;
GRANT USAGE,SELECT ON ALL SEQUENCES IN SCHEMA booking TO booking_app;
DO $$ DECLARE t record; BEGIN
 FOR t IN SELECT tablename FROM pg_tables WHERE schemaname='booking' LOOP
  EXECUTE format('CREATE POLICY server_access ON booking.%I TO booking_app USING (true) WITH CHECK (true)',t.tablename);
 END LOOP;
END $$;
