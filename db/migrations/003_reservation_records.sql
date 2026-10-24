ALTER TABLE booking.reservations ADD COLUMN ordered_items text NOT NULL DEFAULT '' CHECK (length(ordered_items)<=2000);
CREATE TABLE booking.records_export (
 id integer PRIMARY KEY CHECK(id=1),
 dirty boolean NOT NULL DEFAULT true,
 exported_at timestamptz
);
INSERT INTO booking.records_export(id) VALUES(1);
ALTER TABLE booking.records_export ENABLE ROW LEVEL SECURITY;
GRANT SELECT,UPDATE ON booking.records_export TO booking_app;
CREATE POLICY server_access ON booking.records_export TO booking_app USING(true) WITH CHECK(true);
CREATE FUNCTION booking.mark_records_dirty() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 UPDATE booking.records_export SET dirty=true WHERE id=1;
 RETURN NULL;
END $$;
CREATE TRIGGER reservation_records_changed AFTER INSERT OR UPDATE OR DELETE ON booking.reservations
FOR EACH STATEMENT EXECUTE FUNCTION booking.mark_records_dirty();
