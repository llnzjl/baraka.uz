-- One private, immutable evidence receipt for each order the owner marks served.
CREATE TABLE booking.order_receipts (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 receipt_number bigint GENERATED ALWAYS AS IDENTITY UNIQUE NOT NULL,
 order_id uuid UNIQUE NOT NULL REFERENCES booking.dining_orders(id) ON DELETE CASCADE,
 reference text NOT NULL,
 table_name text NOT NULL,
 guest_number bigint NOT NULL,
 guest_name text NOT NULL,
 items jsonb NOT NULL CHECK(jsonb_typeof(items)='array' AND jsonb_array_length(items)>0),
 estimated_total integer CHECK(estimated_total>=0),
 served_at timestamptz NOT NULL,
 purge_at timestamptz NOT NULL
);
-- Preserve already served retained orders when this migration is deployed.
INSERT INTO booking.order_receipts(order_id,reference,table_name,guest_number,guest_name,items,estimated_total,served_at,purge_at)
SELECT id,reference,table_name,guest_number,guest_name,items,estimated_total,updated_at,purge_at
FROM booking.dining_orders WHERE status='served'
ON CONFLICT(order_id) DO NOTHING;
CREATE INDEX order_receipts_retention ON booking.order_receipts(purge_at);
ALTER TABLE booking.order_receipts ENABLE ROW LEVEL SECURITY;
GRANT SELECT,INSERT,DELETE ON booking.order_receipts TO booking_app;
GRANT USAGE,SELECT ON SEQUENCE booking.order_receipts_receipt_number_seq TO booking_app;
CREATE POLICY server_access ON booking.order_receipts TO booking_app USING(true) WITH CHECK(true);
CREATE TRIGGER order_receipts_records_changed AFTER INSERT OR UPDATE OR DELETE ON booking.order_receipts
FOR EACH STATEMENT EXECUTE FUNCTION booking.mark_records_dirty();
