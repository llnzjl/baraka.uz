-- Short-lived, one-time verification for owner credential changes.
CREATE TABLE booking.owner_email_challenges (
 token_hash text PRIMARY KEY CHECK (token_hash ~ '^[a-f0-9]{64}$'),
 session_id uuid NOT NULL REFERENCES booking.entry_sessions(id) ON DELETE CASCADE,
 code_hash bytea NOT NULL CHECK (octet_length(code_hash)=32),
 attempts integer NOT NULL DEFAULT 0 CHECK (attempts BETWEEN 0 AND 5),
 created_at timestamptz NOT NULL DEFAULT now(),
 expires_at timestamptz NOT NULL,
 verified_at timestamptz,
 consumed_at timestamptz
);
CREATE INDEX owner_email_challenges_session_idx ON booking.owner_email_challenges(session_id);
ALTER TABLE booking.owner_email_challenges ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON booking.owner_email_challenges TO booking_app;
CREATE POLICY server_access ON booking.owner_email_challenges TO booking_app USING (true) WITH CHECK (true);
