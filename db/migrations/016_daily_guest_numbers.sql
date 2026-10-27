-- guest_number remains a globally unique private identity. Only the display
-- number repeats, and its mapping survives session logout/expiry.
CREATE TABLE booking.guest_numbers (
 guest_id bigint PRIMARY KEY,
 guest_date date NOT NULL,
 daily_number bigint NOT NULL CHECK(daily_number>0),
 UNIQUE(guest_date,daily_number)
);
-- Preserve existing labels and evidence, including records whose sessions ended.
INSERT INTO booking.guest_numbers(guest_id,guest_date,daily_number)
SELECT guest_number,(min(created_at) AT TIME ZONE 'Asia/Seoul')::date,guest_number
FROM (
 SELECT guest_number,created_at FROM booking.entry_sessions WHERE kind='guest'
 UNION ALL SELECT guest_number,created_at FROM booking.reservations WHERE guest_number IS NOT NULL
 UNION ALL SELECT guest_number,created_at FROM booking.dining_orders
) existing GROUP BY guest_number;
ALTER TABLE booking.guest_numbers ENABLE ROW LEVEL SECURITY;
GRANT SELECT,INSERT ON booking.guest_numbers TO booking_app;
CREATE POLICY server_access ON booking.guest_numbers TO booking_app USING(true) WITH CHECK(true);

CREATE FUNCTION booking.guest_display_number(identity_number bigint) RETURNS bigint
LANGUAGE sql STABLE AS $$
 SELECT COALESCE((SELECT daily_number FROM booking.guest_numbers WHERE guest_id=identity_number),identity_number)
$$;

-- Each login holds the restaurant_config lock before allocating a number.
-- Keep the mapping even after logout so today's number is never reused.
CREATE FUNCTION booking.assign_daily_guest_number() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE day_date date := (statement_timestamp() AT TIME ZONE 'Asia/Seoul')::date;
BEGIN
 IF NEW.kind='guest' THEN
  PERFORM id FROM booking.restaurant_config WHERE id=1 FOR UPDATE;
  INSERT INTO booking.guest_numbers(guest_id,guest_date,daily_number)
  SELECT NEW.guest_number,day_date,COALESCE(max(daily_number),0)+1
  FROM booking.guest_numbers WHERE guest_date=day_date;
  NEW.expires_at := LEAST(NEW.expires_at, (day_date+1)::timestamp AT TIME ZONE 'Asia/Seoul');
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER daily_guest_number BEFORE INSERT ON booking.entry_sessions
FOR EACH ROW EXECUTE FUNCTION booking.assign_daily_guest_number();
UPDATE booking.entry_sessions SET expires_at=LEAST(expires_at,
 ((created_at AT TIME ZONE 'Asia/Seoul')::date+1)::timestamp AT TIME ZONE 'Asia/Seoul')
WHERE kind='guest';
UPDATE booking.records_export SET dirty=true WHERE id=1;
ALTER TABLE booking.records_export ADD COLUMN history_text text;
