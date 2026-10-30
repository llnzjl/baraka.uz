import { RestaurantBackLink } from "@/components/SiteLanguage";
import BookingForm from "@/components/BookingForm";
import type { Metadata } from "next";
export const metadata: Metadata = { title: "BARAKA - Reserve a table" };
export default function Page() {
  return (
    <main className="reservation-section section-shell">
      <RestaurantBackLink />
      <BookingForm />
    </main>
  );
}
