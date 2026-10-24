-- Anonymous, email-verified password reset challenges for the single restaurant owner.
CREATE TABLE booking.owner_password_resets (
 token_hash text PRIMARY KEY CHECK (token_hash ~ '^[a-f0-9]{64}$'),
 code_hash bytea NOT NULL CHECK (octet_length(code_hash)=32),
 attempts integer NOT NULL DEFAULT 0 CHECK (attempts BETWEEN 0 AND 5),
 created_at timestamptz NOT NULL DEFAULT now(),
 expires_at timestamptz NOT NULL,
 verified_at timestamptz,
 consumed_at timestamptz
);
ALTER TABLE booking.owner_password_resets ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON booking.owner_password_resets TO booking_app;
CREATE POLICY server_access ON booking.owner_password_resets TO booking_app USING (true) WITH CHECK (true);
