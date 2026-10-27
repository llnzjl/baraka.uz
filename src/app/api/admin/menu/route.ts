import { admin, handle, origin } from "@/lib/booking/http";
import { adminMenu, saveMenuItem } from "@/lib/menu/engine";
import { BookingError } from "@/lib/booking/validation";
import { parseMenuForm } from "@/lib/menu/http";
export const runtime = "nodejs";

export async function GET(request: Request) {
  return handle(async () => {
    await admin(request);
    return { items: await adminMenu() };
  });
}
export async function POST(request: Request) {
  return handle(async () => {
    origin(request);
    const user = await admin(request);
    const { item, image, removeImage } = await parseMenuForm(request);
    if (item.id) throw new BookingError("INVALID_INPUT", 400);
    return { item: await saveMenuItem(item, user.id, image, removeImage) };
  });
}
