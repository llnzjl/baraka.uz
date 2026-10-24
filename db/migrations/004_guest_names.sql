ALTER TABLE booking.entry_sessions ADD COLUMN display_name text NOT NULL DEFAULT '' CHECK(length(display_name)<=80);
ALTER TABLE booking.reservations ADD COLUMN guest_name text NOT NULL DEFAULT '' CHECK(length(guest_name)<=80);
UPDATE booking.reservations SET guest_name=name;
