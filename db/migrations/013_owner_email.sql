ALTER TABLE booking.owner_credentials
  ADD COLUMN owner_email text;

COMMENT ON COLUMN booking.owner_credentials.owner_email IS 'Owner notification and recovery email, private to owner profile';
