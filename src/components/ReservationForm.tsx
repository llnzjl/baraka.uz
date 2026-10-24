"use client";
import BookingForm from "./BookingForm";
export default function ReservationForm({
  language = "ko",
}: {
  language?: "en" | "ko";
  phone?: string;
  instagramUrl?: string;
}) {
  return <BookingForm initialLocale={language} />;
}
