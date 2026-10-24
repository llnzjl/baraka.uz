CREATE TABLE booking.owner_credentials (
 id integer PRIMARY KEY CHECK (id = 1),
 username text NOT NULL CHECK (username ~ '^[A-Za-z0-9_.-]{3,100}$'),
 password_salt text NOT NULL CHECK (password_salt ~ '^[a-f0-9]{64}$'),
 password_hash text NOT NULL CHECK (password_hash ~ '^[a-f0-9]{128}$'),
 credential_version bigint NOT NULL DEFAULT 1 CHECK (credential_version > 0),
 updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE booking.owner_credentials ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON booking.owner_credentials TO booking_app;
CREATE POLICY server_access ON booking.owner_credentials TO booking_app USING (true) WITH CHECK (true);
