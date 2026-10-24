import OrderAdmin from "@/components/OrderAdmin";
export const metadata = {
  title: "BARAKA · Order queue",
  robots: { index: false, follow: false },
};
export default function Page() {
  return <OrderAdmin />;
}
