import { handle, origin, limit, clientIp, body } from "@/lib/booking/http";
import { orderGuest } from "@/lib/orders/http";
import { createOrder, guestOrders } from "@/lib/orders/engine";
import { orderSchema } from "@/lib/orders/validation";
export const runtime = "nodejs";
export async function GET(request: Request) {
  return handle(async () => {
    const s = await orderGuest(request);
    await limit("guest-orders-read", s.id, 60, 60);
    return { orders: await guestOrders(s.id) };
  });
}
export async function POST(request: Request) {
  return handle(async () => {
    origin(request);
    const s = await orderGuest(request);
    await limit("orders-ip", clientIp(request), 120, 600);
    await limit("orders-guest", s.id, 10, 600);
    const v = orderSchema.parse(await body(request));
    const r = await createOrder(v, s.id);
    return {
      order: {
        id: r.id,
        queue_number: r.queue_number,
        reference: r.reference,
        table_name: r.table_name,
        guest_name: r.guest_name,
        items: r.items,
        estimated_total: r.estimated_total,
        status: r.status,
        created_at: r.created_at,
      },
    };
  });
}
