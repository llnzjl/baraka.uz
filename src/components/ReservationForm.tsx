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
  if (process.env.NEXT_PUBLIC_GITHUB_PAGES === "true") {
    const callLabel = language === "ko" ? "전화로 예약하기" : "Call to reserve";
    const message =
      language === "ko"
        ? "온라인 예약은 현재 제공되지 않습니다. 전화로 문의해 주세요."
        : "Online reservations are unavailable here. Please call the restaurant.";
    return (
      <div className="booking-flow">
        <p>{message}</p>
        <a className="button button-green" href={`tel:${phone.replace(/[^+\d]/g, "")}`}>
          {callLabel}
        </a>
      </div>
    );
  }
  return <BookingForm initialLocale={language} />;
}
