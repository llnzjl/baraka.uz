import { admin, handle, origin } from "@/lib/booking/http";
import { BookingError } from "@/lib/booking/validation";
import { saveMenuItem } from "@/lib/menu/engine";
import { z } from "zod";
import { parseMenuForm } from "@/lib/menu/http";

export const runtime = "nodejs";
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    origin(request);
    const user = await admin(request);
    const { id } = await params;
    z.string().regex(/^[a-z0-9][a-z0-9-]{0,79}$/).parse(id);
    const { item, image, removeImage } = await parseMenuForm(request);
    if (item.id !== id) throw new BookingError("INVALID_INPUT", 400);
    return { item: await saveMenuItem(item, user.id, image, removeImage) };
  });
}
