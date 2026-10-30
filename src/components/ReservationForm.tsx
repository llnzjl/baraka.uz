"use client";
import { translate, type Language } from "@/lib/site-language";
import BookingForm from "./BookingForm";
import { demoAuthEnabled, staticSiteOnly } from "@/lib/client/api";
import { restaurant } from "@/data/restaurant";
export default function ReservationForm({
  language = "ko",
  phone = "043-268-8329",
}: {
  language?: Language;
  phone?: string;
  instagramUrl?: string;
}) {
  if (demoAuthEnabled || staticSiteOnly) return (
    <div className="booking-form">
      <p>{translate(language, "Online reservations are not available yet. Please call us for reservations and orders.", "온라인 예약은 아직 준비 중입니다. 예약 및 주문은 전화로 문의해 주세요.")}</p>
      <a className="button button-green" href={restaurant.phoneHref}>{phone}</a>
    </div>
  );
  return <BookingForm initialLocale={language} />;
}
