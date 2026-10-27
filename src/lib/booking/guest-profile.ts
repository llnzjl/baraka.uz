import { createHash } from "node:crypto";
import { recordedTransaction } from "./records";
import { BookingError, guestProfileSchema } from "./validation";
import type { EntrySession } from "./sessions";

export function sessionView(s: EntrySession) {
  return {
    kind: s.kind,
    number: s.kind === "guest" ? s.daily_number : null,
    displayName:
      s.kind === "guest"
        ? s.display_name || `Guest ${s.daily_number}`
        : "Owner",
  };
}
export async function changeGuestName(
  token: string | undefined,
  displayName: string,
) {
  const value = guestProfileSchema.parse({ displayName }).displayName;
  if (!token || !/^[a-f0-9]{64}$/.test(token))
    throw new BookingError("UNAUTHORIZED", 401);
  return recordedTransaction(async (c) => {
    // Same lock order as booking creation prevents stale profile names in new records.
    await c.query(
      "SELECT id FROM booking.restaurant_config WHERE id=1 FOR UPDATE",
    );
    const s = (
      await c.query(
        "SELECT *,booking.guest_display_number(guest_number) AS daily_number FROM booking.entry_sessions WHERE token_hash=$1 AND kind='guest' AND expires_at>now() FOR UPDATE",
        [createHash("sha256").update(token).digest("hex")],
      )
    ).rows[0];
    if (!s) throw new BookingError("UNAUTHORIZED", 401);
    await c.query(
      "UPDATE booking.entry_sessions SET display_name=$2 WHERE guest_number=$1 AND kind='guest'",
      [s.guest_number, value],
    );
    await c.query(
      "UPDATE booking.reservations SET guest_name=$2,version=version+1,updated_at=now() WHERE guest_number=$1 AND purge_at>now() AND guest_name<>$2",
      [s.guest_number, value],
    );
    await c.query(
      "UPDATE booking.dining_orders SET guest_name=$2,version=version+1,updated_at=now() WHERE guest_number=$1 AND purge_at>now() AND guest_name<>$2",
      [s.guest_number, value],
    );
    await c.query("INSERT INTO booking.audit_log(actor,action) VALUES($1,$2)", [
      s.id,
      "guest profile name changed",
    ]);
    return sessionView({ ...s, display_name: value });
  });
}
