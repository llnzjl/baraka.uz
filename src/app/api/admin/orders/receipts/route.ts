import { handle, admin } from "@/lib/booking/http";
import { receiptsText } from "@/lib/booking/records";
import { transaction } from "@/lib/booking/db";

export const runtime = "nodejs";
export async function GET(request: Request) {
  let contents = "";
  const result = await handle(async () => {
    const user = await admin(request);
    contents = await transaction(async (c) => {
      await c.query("INSERT INTO booking.audit_log(actor,action) VALUES($1,$2)", [user.id, "download served meal receipts"]);
      return receiptsText(c);
    });
    return { ok: true };
  });
  if (!result.ok) return result;
  return new Response(contents, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Content-Disposition": 'attachment; filename="receipts.txt"',
      "Cache-Control": "no-store, private",
      "X-Content-Type-Options": "nosniff",
      "Referrer-Policy": "no-referrer",
    },
  });
}
