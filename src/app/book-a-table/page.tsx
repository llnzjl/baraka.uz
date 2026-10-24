import Link from "next/link";
import BookingForm from "@/components/BookingForm";
import { Locale, locales } from "@/lib/booking/validation";
import { bookingCopy } from "@/lib/booking/copy";
import type { Metadata } from "next";
type Props = { searchParams: Promise<{ lang?: string }> };
function locale(value?: string): Locale {
  return locales.includes(value as Locale) ? (value as Locale) : "ko";
}
export async function generateMetadata({
  searchParams,
}: Props): Promise<Metadata> {
  const lang = locale((await searchParams).lang);
  return { title: `BARAKA - ${bookingCopy[lang].title}` };
}
export default async function Page({ searchParams }: Props) {
  const lang = locale((await searchParams).lang);
  return (
    <main className="reservation-section section-shell">
      <Link className="text-link" href="/">
        {bookingCopy[lang].back}
      </Link>
      <BookingForm initialLocale={lang} />
    </main>
  );
}
