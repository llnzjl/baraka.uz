import GuestProfile from "@/components/GuestProfile";
export const metadata = {
  title: "BARAKA · Your guest profile",
  robots: { index: false, follow: false },
};
export default function Page() {
  return <GuestProfile />;
}
