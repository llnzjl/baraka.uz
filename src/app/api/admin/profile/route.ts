import { body, handle, limit, origin, owner } from "@/lib/booking/http";
import { database } from "@/lib/booking/db";
import { changeOwnerPasswordFromSession, updateOwnerProfileFromSession } from "@/lib/booking/sessions";
import { BookingError, phoneSchema } from "@/lib/booking/validation";
import { z } from "zod";

export const runtime = "nodejs";

export async function GET(request: Request) {
  return handle(async () => {
    await owner(request);
    const profile = (await database().query(
      "SELECT username,owner_name,owner_phone FROM booking.owner_credentials WHERE id=1",
    )).rows[0] as { username: string; owner_name: string | null; owner_phone: string | null } | undefined;
    if (!profile) throw new BookingError("UNAVAILABLE", 503);
    return {
      name: profile.owner_name || process.env.OWNER_NAME?.trim() || profile.username,
      username: profile.username,
      phone: profile.owner_phone || process.env.OWNER_PHONE?.trim() || "",
    };
  });
}

const passwordChange = z.object({
  currentPassword: z.string().min(1).max(256),
  newPassword: z.string().min(1).max(256),
  confirmPassword: z.string().min(1).max(256),
}).strict().refine((value) => value.newPassword === value.confirmPassword, {
  message: "Passwords do not match.", path: ["confirmPassword"],
});

const ownerProfileChange = z.object({
  username: z.string().trim().regex(/^[A-Za-z0-9_.-]{3,100}$/),
  name: z.string().trim().min(1).max(100),
  phone: z.union([z.literal(""), phoneSchema]),
}).strict();

export async function PUT(request: Request) {
  return handle(async () => {
    origin(request);
    const session = await owner(request);
    await limit("owner-profile-update", session.id, 5, 3600);
    const input = ownerProfileChange.parse(await body(request));
    const profile = await updateOwnerProfileFromSession({ ...input, sessionId: session.id });
    return {
      name: profile.owner_name,
      username: profile.username,
      phone: profile.owner_phone || "",
    };
  });
}

export async function PATCH(request: Request) {
  return handle(async () => {
    origin(request);
    const session = await owner(request);
    await limit("owner-profile-password", session.id, 5, 3600);
    const input = passwordChange.parse(await body(request));
    await changeOwnerPasswordFromSession(session.id, input.currentPassword, input.newPassword);
    return { ok: true };
  });
}
