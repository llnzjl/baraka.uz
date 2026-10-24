ALTER TABLE booking.records_export
  ADD COLUMN reservation_text text NOT NULL DEFAULT '',
  ADD COLUMN orders_text text NOT NULL DEFAULT '',
  ADD COLUMN receipts_text text NOT NULL DEFAULT '';
