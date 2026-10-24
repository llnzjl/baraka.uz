import { response } from "@/lib/booking/http";
import { menuImage } from "@/lib/menu/engine";
import { BookingError } from "@/lib/booking/validation";
import { z } from "zod";

export const runtime = "nodejs";
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    z.string().regex(/^[a-z0-9][a-z0-9-]{0,79}$/).parse(id);
    const image = await menuImage(id);
    return new Response(new Uint8Array(image.bytes), {
      headers: {
        "Content-Type": image.type,
        "Cache-Control": "public, max-age=31536000, immutable",
        "X-Content-Type-Options": "nosniff",
        "ETag": `\"${image.updatedAt}\"`,
      },
    });
  } catch (error) {
    if (error instanceof BookingError) return response({ error: error.code },error.status);
    if (error instanceof z.ZodError) return response({ error: "NOT_FOUND" },404);
    return response({ error: "UNAVAILABLE" },503);
  }
}
