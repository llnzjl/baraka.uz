import { z } from "zod";
import { updateReservation, updateOrderedItems } from "@/lib/booking/engine";
import { statusSchema, orderedItemsSchema } from "@/lib/booking/validation";
import { handle, admin, body, origin } from "@/lib/booking/http";
export const runtime = "nodejs";
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  return handle(async () => {
    origin(request);
    const user = await admin(request);
    const id = z
      .string()
      .uuid()
      .parse((await params).id);
    const v = z
      .union([statusSchema, orderedItemsSchema])
      .parse(await body(request));
    if ("orderedItems" in v)
      return updateOrderedItems(id, v.orderedItems, v.version, user.id);
    return updateReservation(id, v.status, v.version, user.id);
  });
}
