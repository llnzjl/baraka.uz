import { z } from "zod";
import { handle, admin, origin, body } from "@/lib/booking/http";
import { changeOrderStatus } from "@/lib/orders/engine";
import { orderStatusSchema } from "@/lib/orders/validation";
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
    const v = orderStatusSchema.parse(await body(request));
    return { order: await changeOrderStatus(id, v.status, v.version, user.id) };
  });
}
