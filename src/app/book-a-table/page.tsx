import Link from "next/link";
import BookingForm from "@/components/BookingForm";
import type { Metadata } from "next";
export const metadata: Metadata = { title: "BARAKA - Reserve a table" };
export default function Page() {
  return (
    <main className="reservation-section section-shell">
      <Link className="text-link" href="/">
        Back to BARAKA
      </Link>
      <BookingForm />
    </main>
  );
}
