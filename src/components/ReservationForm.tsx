"use client";
import BookingForm from "./BookingForm";
export default function ReservationForm({
  language = "ko",
  phone = "043-268-8329",
}: {
  language?: "en" | "ko";
  phone?: string;
  instagramUrl?: string;
}) {
  return <BookingForm initialLocale={language} />;
}
