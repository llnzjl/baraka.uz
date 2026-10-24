CREATE TABLE booking.dining_orders (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 queue_number bigint GENERATED ALWAYS AS IDENTITY UNIQUE NOT NULL,
 reference text UNIQUE NOT NULL,
 idempotency_key uuid UNIQUE NOT NULL,
 request_hash text NOT NULL,
 guest_number bigint NOT NULL,
 guest_name text NOT NULL CHECK(length(guest_name) BETWEEN 1 AND 80),
 table_id uuid NOT NULL REFERENCES booking.dining_tables(id),
 table_name text NOT NULL,
 items jsonb NOT NULL CHECK(jsonb_typeof(items)='array' AND jsonb_array_length(items) BETWEEN 1 AND 30),
 estimated_total integer CHECK(estimated_total>=0),
 status text NOT NULL DEFAULT 'queued' CHECK(status IN ('queued','preparing','ready','served','cancelled')),
 version integer NOT NULL DEFAULT 1,
 created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 purge_at timestamptz NOT NULL
);
CREATE INDEX dining_orders_queue ON booking.dining_orders(queue_number) WHERE status IN ('queued','preparing','ready');
CREATE INDEX dining_orders_guest ON booking.dining_orders(guest_number,created_at);
CREATE INDEX dining_orders_retention ON booking.dining_orders(purge_at);
ALTER TABLE booking.dining_orders ENABLE ROW LEVEL SECURITY;
GRANT SELECT,INSERT,UPDATE,DELETE ON booking.dining_orders TO booking_app;
GRANT USAGE,SELECT ON SEQUENCE booking.dining_orders_queue_number_seq TO booking_app;
CREATE POLICY server_access ON booking.dining_orders TO booking_app USING(true) WITH CHECK(true);
ALTER TABLE booking.audit_log ADD COLUMN order_id uuid REFERENCES booking.dining_orders(id) ON DELETE SET NULL;
CREATE TRIGGER dining_orders_records_changed AFTER INSERT OR UPDATE OR DELETE ON booking.dining_orders
FOR EACH STATEMENT EXECUTE FUNCTION booking.mark_records_dirty();
