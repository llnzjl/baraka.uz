CREATE SEQUENCE booking.entry_sessions_guest_number_seq;
CREATE TABLE booking.entry_sessions (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 token_hash text UNIQUE NOT NULL,
 kind text NOT NULL CHECK (kind IN ('owner','guest')),
 guest_number bigint UNIQUE,
 credential_version text,
 created_at timestamptz NOT NULL DEFAULT now(),
 expires_at timestamptz NOT NULL,
 last_seen timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX entry_sessions_expiry ON booking.entry_sessions(expires_at);
ALTER TABLE booking.entry_sessions ENABLE ROW LEVEL SECURITY;
GRANT SELECT,INSERT,UPDATE,DELETE ON booking.entry_sessions TO booking_app;
GRANT USAGE,SELECT ON SEQUENCE booking.entry_sessions_guest_number_seq TO booking_app;
CREATE POLICY server_access ON booking.entry_sessions TO booking_app USING(true) WITH CHECK(true);
ALTER TABLE booking.reservations ADD COLUMN guest_number bigint;
