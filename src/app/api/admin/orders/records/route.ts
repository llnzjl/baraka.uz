import { admin, handle } from "@/lib/booking/http";
import { transaction } from "@/lib/booking/db";
import { ordersText } from "@/lib/booking/records";
export const runtime = "nodejs";
export async function GET(request: Request) {
  let contents = "";
  const result = await handle(async () => {
    const user = await admin(request);
    contents = await transaction(async (c) => {
      await c.query(
        "INSERT INTO booking.audit_log(actor,action) VALUES($1,$2)",
        [user.id, "download order records"],
      );
      return ordersText(c);
    });
    return { ok: true };
  });
  if (!result.ok) return result;
  return new Response(contents, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Content-Disposition": 'attachment; filename="orders.txt"',
      "Cache-Control": "no-store, private",
      "X-Content-Type-Options": "nosniff",
      "Referrer-Policy": "no-referrer",
    },
  });
}
