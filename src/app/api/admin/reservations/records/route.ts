import { admin, handle } from "@/lib/booking/http";
import { transaction } from "@/lib/booking/db";
import { recordsText } from "@/lib/booking/records";
export const runtime = "nodejs";
export async function GET(request: Request) {
  let contents = "";
  const auth = await handle(async () => {
    const user = await admin(request);
    contents = await transaction(async (c) => {
      await c.query(
        "INSERT INTO booking.audit_log(actor,action) VALUES($1,$2)",
        [user.id, "download reservation records"],
      );
      return recordsText(c);
    });
    return { ok: true };
  });
  if (!auth.ok) return auth;
  return new Response(contents, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Content-Disposition": 'attachment; filename="reservations.txt"',
      "Cache-Control": "no-store, private",
      "X-Content-Type-Options": "nosniff",
      "Referrer-Policy": "no-referrer",
    },
  });
}
