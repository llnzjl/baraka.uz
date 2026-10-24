CREATE TABLE booking.restaurant_menu (
 id text PRIMARY KEY CHECK(id ~ '^[a-z0-9][a-z0-9-]{0,79}$'),
 name text NOT NULL CHECK(length(name) BETWEEN 1 AND 100),
 name_ko text NOT NULL CHECK(length(name_ko) BETWEEN 1 AND 100),
 category text NOT NULL CHECK(category IN ('mains','grill','soups','bakery','salads','drinks')),
 description text NOT NULL DEFAULT '' CHECK(length(description)<=500),
 description_ko text NOT NULL DEFAULT '' CHECK(length(description_ko)<=500),
 price integer CHECK(price BETWEEN 0 AND 5000000),
 active boolean NOT NULL DEFAULT true,
 image_data bytea CHECK(image_data IS NULL OR octet_length(image_data)<=3145728),
 image_type text CHECK(image_type IS NULL OR image_type IN ('image/jpeg','image/png','image/webp')),
 image_version uuid,
 updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 CHECK((image_data IS NULL)=(image_type IS NULL))
);
CREATE INDEX restaurant_menu_public ON booking.restaurant_menu(active,category,name);
ALTER TABLE booking.restaurant_menu ENABLE ROW LEVEL SECURITY;
GRANT SELECT,INSERT,UPDATE ON booking.restaurant_menu TO booking_app;
CREATE POLICY server_access ON booking.restaurant_menu TO booking_app USING(true) WITH CHECK(true);
