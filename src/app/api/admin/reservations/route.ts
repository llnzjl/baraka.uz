import { syncRecordsSafely } from "@/lib/booking/records";
import { listReservations, createReservation } from "@/lib/booking/engine";
import { dateSchema, bookingSchema } from "@/lib/booking/validation";
import { handle, admin, body, origin } from "@/lib/booking/http";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET(request: Request) {
  return handle(async () => {
    const user = await admin(request);
    const date = dateSchema.parse(
      new URL(request.url).searchParams.get("date"),
    );
    return {
      reservations: await listReservations(date, user.id),
      role: user.role,
      recordsSynced: (await syncRecordsSafely()).synced,
    };
  });
}
export async function POST(request: Request) {
  return handle(async () => {
    origin(request);
    const user = await admin(request);
    return createReservation(bookingSchema.parse(await body(request)), user.id);
  });
}
