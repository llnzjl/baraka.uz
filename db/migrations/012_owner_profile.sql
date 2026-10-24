ALTER TABLE booking.owner_credentials
  ADD COLUMN owner_name text,
  ADD COLUMN owner_phone text;

COMMENT ON COLUMN booking.owner_credentials.owner_name IS 'Owner display name, private to owner profile';
COMMENT ON COLUMN booking.owner_credentials.owner_phone IS 'Owner contact phone, private to owner profile';
