-- Username reservations and account-to-guest mapping. Email/password remain in Supabase Auth.
CREATE TABLE booking.customer_accounts (
 guest_number bigint PRIMARY KEY DEFAULT nextval('booking.entry_sessions_guest_number_seq'),
 username text NOT NULL UNIQUE CHECK (username = lower(username) AND username ~ '^[a-zA-Z0-9_.-]{3,40}$'),
 auth_user_id uuid UNIQUE,
 display_name text NOT NULL CHECK (length(display_name) BETWEEN 1 AND 80),
 verified_at timestamptz,
 registration_key_hash text,
 reserved_until timestamptz,
 created_at timestamptz NOT NULL DEFAULT now(),
 CHECK ((auth_user_id IS NULL) = (registration_key_hash IS NOT NULL))
);
CREATE INDEX customer_accounts_registration_expiry ON booking.customer_accounts(reserved_until) WHERE auth_user_id IS NULL;
ALTER TABLE booking.customer_accounts ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON booking.customer_accounts TO booking_app;
GRANT USAGE, SELECT ON SEQUENCE booking.entry_sessions_guest_number_seq TO booking_app;
CREATE POLICY server_access ON booking.customer_accounts TO booking_app USING (true) WITH CHECK (true);

-- One account may have multiple active devices/sessions, all tied to its stable guest number.
ALTER TABLE booking.entry_sessions DROP CONSTRAINT IF EXISTS entry_sessions_guest_number_key;
CREATE INDEX entry_sessions_guest_number_idx ON booking.entry_sessions(guest_number);
