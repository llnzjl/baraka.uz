import ReservationAdmin from "@/components/ReservationAdmin";
export const metadata = {
  title: "BARAKA · Reservation management",
  robots: { index: false, follow: false },
};
export default function Page() {
  return <ReservationAdmin />;
}
