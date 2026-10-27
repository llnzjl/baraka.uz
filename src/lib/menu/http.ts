import { BookingError } from "@/lib/booking/validation";
import { menuItemSchema } from "./engine";
import sharp from "sharp";

const MAX_UPLOAD_BYTES = 100 * 1024 * 1024;
const MAX_IMAGE_PIXELS = 100_000_000;
const MAX_STORED_BYTES = 3 * 1024 * 1024;
export async function parseMenuForm(request: Request) {
  const length = Number(request.headers.get("content-length") || 0);
  if (length > MAX_UPLOAD_BYTES + 64_000) throw new BookingError("IMAGE_TOO_LARGE", 413);
  if (!request.headers.get("content-type")?.startsWith("multipart/form-data"))
    throw new BookingError("INVALID_INPUT", 415);
  const form = await request.formData();
  let raw: unknown;
  try { raw = JSON.parse(String(form.get("item") || "")); }
  catch { throw new BookingError("INVALID_INPUT", 400); }
  const item = menuItemSchema.parse(raw);
  const removeImage = form.get("removeImage") === "true";
  const file = form.get("image");
  if (!(file instanceof File) || file.size === 0) return { item, image: undefined, removeImage };
  if (file.size > MAX_UPLOAD_BYTES) throw new BookingError("IMAGE_TOO_LARGE", 413);
  const bytes = Buffer.from(await file.arrayBuffer());
  const signatures: [string, number[]][] = [
    ["image/jpeg", [0xff,0xd8,0xff]],
    ["image/png", [0x89,0x50,0x4e,0x47,0x0d,0x0a,0x1a,0x0a]],
    ["image/webp", [0x52,0x49,0x46,0x46]],
  ];
  const type = signatures.find(([_, sig]) => sig.every((byte, i) => bytes[i] === byte))?.[0];
  if (!type || type !== file.type || (type === "image/webp" && bytes.toString("ascii",8,12) !== "WEBP"))
    throw new BookingError("INVALID_IMAGE", 400);
  try {
    const metadata = await sharp(bytes,{limitInputPixels:MAX_IMAGE_PIXELS}).metadata();
    if (!metadata.width || !metadata.height || metadata.width*metadata.height>MAX_IMAGE_PIXELS || (metadata.pages||1)>1)
      throw new BookingError("IMAGE_TOO_LARGE",413);
    let optimized = await sharp(bytes,{limitInputPixels:MAX_IMAGE_PIXELS})
      .rotate().resize({width:2200,height:2200,fit:"inside",withoutEnlargement:true})
      .webp({quality:82,effort:4}).toBuffer();
    if (optimized.length>MAX_STORED_BYTES) {
      optimized = await sharp(bytes,{limitInputPixels:MAX_IMAGE_PIXELS})
        .rotate().resize({width:1600,height:1600,fit:"inside",withoutEnlargement:true})
        .webp({quality:70,effort:4}).toBuffer();
    }
    if (optimized.length>MAX_STORED_BYTES) throw new BookingError("IMAGE_TOO_LARGE",413);
    return { item, image: { bytes: optimized, type: "image/webp" }, removeImage: false };
  } catch (error) {
    if (error instanceof BookingError) throw error;
    throw new BookingError("INVALID_IMAGE",400);
  }
}
