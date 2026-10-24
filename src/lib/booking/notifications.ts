import { randomUUID } from "crypto";
import { database, transaction } from "./db";
import { BookingError } from "./validation";

export async function processNotifications() {
  if (!process.env.RESEND_API_KEY || !process.env.RESEND_FROM)
    return { sent: 0, failed: 0, disabled: true };
  let sent = 0,
    failed = 0;
  for (let n = 0; n < 3; n++) {
    const lease = randomUUID();
    const job = await transaction(async (c) => {
      // Stop automatic retries before Resend's 24h idempotency window expires.
      await c.query(
        "UPDATE booking.notifications SET status='failed',last_error='RETRY_WINDOW_EXPIRED' WHERE status IN ('queued','sending') AND created_at<now()-interval '23 hours' AND (locked_until IS NULL OR locked_until<now())",
      );
      const j = (
        await c.query(
          `SELECT * FROM booking.notifications WHERE attempts<10 AND available_at<=now() AND (status='queued' OR (status='sending' AND locked_until<now())) ORDER BY created_at FOR UPDATE SKIP LOCKED LIMIT 1`,
        )
      ).rows[0];
      if (!j) return null;
      await c.query(
        "UPDATE booking.notifications SET status='sending',attempts=attempts+1,locked_until=now()+interval '2 minutes',lease_id=$2 WHERE id=$1",
        [j.id, lease],
      );
      return j;
    });
    if (!job) break;
    try {
      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
          "Content-Type": "application/json",
          "Idempotency-Key": `booking/${job.id}`,
        },
        body: JSON.stringify({
          from: process.env.RESEND_FROM,
          to: [job.recipient],
          subject: job.subject,
          text: job.body,
        }),
        signal: AbortSignal.timeout(15000),
      });
      if (!res.ok) throw new Error(`HTTP_${res.status}`);
      const result = await res.json();
      if (typeof result.id !== "string") throw new Error("PROVIDER_RESPONSE");
      await database().query(
        "UPDATE booking.notifications SET status='sent',sent_at=now(),provider_id=$3,locked_until=NULL,last_error=NULL WHERE id=$1 AND lease_id=$2",
        [job.id, lease, result.id],
      );
      sent++;
    } catch {
      const next = job.attempts + 1;
      await database().query(
        "UPDATE booking.notifications SET status=$3,available_at=now()+$4*interval '1 second',locked_until=NULL,last_error='DELIVERY_FAILED' WHERE id=$1 AND lease_id=$2",
        [
          job.id,
          lease,
          next >= 10 ? "failed" : "queued",
          Math.min(3600, 30 * 2 ** next),
        ],
      );
      failed++;
    }
  }
  return { sent, failed };
}
