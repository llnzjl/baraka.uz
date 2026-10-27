import process from "node:process";
import { Buffer } from "node:buffer";
import { ImageMagick, initializeImageMagick, MagickFormat } from "@imagemagick/magick-wasm";
import { admin } from "../src/lib/booking/http.ts";
import { handle, origin, response } from "../src/lib/booking/http.ts";
import { BookingError } from "../src/lib/booking/validation.ts";
import { adminMenu, menuItemSchema, menuImage, saveMenuItem } from "../src/lib/menu/engine.ts";
import * as sessionRoute from "../src/app/api/session/route.ts";
import * as reservationsRoute from "../src/app/api/reservations/route.ts";
import * as availabilityRoute from "../src/app/api/reservations/availability/route.ts";
import * as adminReservationsRoute from "../src/app/api/admin/reservations/route.ts";
import * as adminReservationRoute from "../src/app/api/admin/reservations/[id]/route.ts";
import * as reservationRecordsRoute from "../src/app/api/admin/reservations/records/route.ts";
import * as configRoute from "../src/app/api/admin/config/route.ts";
import * as profileRoute from "../src/app/api/admin/profile/route.ts";
import * as menuRoute from "../src/app/api/menu/route.ts";
import * as ordersRoute from "../src/app/api/orders/route.ts";
import * as orderCatalogRoute from "../src/app/api/orders/catalog/route.ts";
import * as adminOrdersRoute from "../src/app/api/admin/orders/route.ts";
import * as adminOrderRoute from "../src/app/api/admin/orders/[id]/route.ts";
import * as orderCountRoute from "../src/app/api/admin/orders/count/route.ts";
import * as orderRecordsRoute from "../src/app/api/admin/orders/records/route.ts";
import * as receiptsRoute from "../src/app/api/admin/orders/receipts/route.ts";
import * as historyRoute from "../src/app/api/admin/history/route.ts";
import * as notificationsRoute from "../src/app/api/jobs/notifications/route.ts";
import * as recordsJobRoute from "../src/app/api/jobs/records/route.ts";
import * as retentionRoute from "../src/app/api/jobs/retention/route.ts";

Object.assign(process.env, Deno.env.toObject(), {
  BARAKA_EDGE: "true",
  NODE_ENV: "production",
});
process.env.DATABASE_URL ||= Deno.env.get("DATABASE_URL") || "";

const allowedOrigin = () => process.env.APP_ORIGIN || "";
const allowedHeaders = "authorization, content-type";

function cors(responseToWrap: Response, originHeader: string | null) {
  const headers = new Headers(responseToWrap.headers);
  if (originHeader && originHeader === allowedOrigin()) {
    headers.set("Access-Control-Allow-Origin", originHeader);
    headers.set("Access-Control-Allow-Headers", allowedHeaders);
    headers.set("Access-Control-Allow-Methods", "GET, POST, PATCH, PUT, DELETE, OPTIONS");
    headers.set("Vary", "Origin");
  }
  return new Response(responseToWrap.body, {
    status: responseToWrap.status,
    statusText: responseToWrap.statusText,
    headers,
  });
}

function apiPath(url: URL) {
  if (url.pathname === "/api") return "/";
  return url.pathname.startsWith("/api/")
    ? url.pathname.slice("/api".length)
    : url.pathname;
}

function routeModule(path: string, method: string) {
  if (path === "/session") return sessionRoute;
  if (path === "/reservations/availability") return availabilityRoute;
  if (path === "/reservations") return reservationsRoute;
  if (path === "/admin/reservations") return adminReservationsRoute;
  if (path === "/admin/reservations/records") return reservationRecordsRoute;
  if (path === "/admin/config") return configRoute;
  if (path === "/admin/profile") return profileRoute;
  if (path === "/menu") return menuRoute;
  if (path === "/orders") return ordersRoute;
  if (path === "/orders/catalog") return orderCatalogRoute;
  if (path === "/admin/orders") return adminOrdersRoute;
  if (path === "/admin/orders/count") return orderCountRoute;
  if (path === "/admin/orders/records") return orderRecordsRoute;
  if (path === "/admin/orders/receipts") return receiptsRoute;
  if (path === "/admin/history") return historyRoute;
  if (path === "/jobs/notifications") return notificationsRoute;
  if (path === "/jobs/records") return recordsJobRoute;
  if (path === "/jobs/retention") return retentionRoute;
  if (/^\/admin\/reservations\/[^/]+$/.test(path)) return adminReservationRoute;
  if (/^\/admin\/orders\/[^/]+$/.test(path)) return adminOrderRoute;
  return null;
}

async function optimizeMenuImage(file: File) {
  const maxUpload = 5 * 1024 * 1024;
  if (file.size > maxUpload) throw new BookingError("IMAGE_TOO_LARGE", 413);
  const input = new Uint8Array(await file.arrayBuffer());
  const isWebp = input.length > 12 &&
    String.fromCharCode(...input.slice(0, 4)) === "RIFF" &&
    String.fromCharCode(...input.slice(8, 12)) === "WEBP";
  if (!isWebp || file.type !== "image/webp") throw new BookingError("INVALID_IMAGE", 400);
  // Animated WebP files contain animation control/frame chunks. Customer uploads
  // are flattened in the browser; reject animation from clients that bypass it.
  for (let offset = 12; offset + 8 <= input.length;) {
    const kind = String.fromCharCode(...input.slice(offset, offset + 4));
    const size = new DataView(input.buffer, input.byteOffset + offset + 4, 4).getUint32(0, true);
    if (kind === "ANIM" || kind === "ANMF") throw new BookingError("INVALID_IMAGE", 400);
    offset += 8 + size + (size % 2);
  }
  const wasmUrl = import.meta.resolve("@imagemagick/magick-wasm/magick.wasm");
  await initializeImageMagick(await Deno.readFile(new URL(wasmUrl)));
  let width = 0;
  let height = 0;
  const output = ImageMagick.read(input, (image) => {
    width = image.width;
    height = image.height;
    if (!width || !height || width * height > 100_000_000) {
      throw new BookingError("IMAGE_TOO_LARGE", 413);
    }
    image.strip();
    image.resize(2200, 2200);
    image.format = MagickFormat.WebP;
    return image.write((bytes) => bytes);
  });
  if (output.byteLength > 3 * 1024 * 1024) throw new BookingError("IMAGE_TOO_LARGE", 413);
  return { bytes: Buffer.from(output), type: "image/webp" };
}

async function menuAdmin(request: Request, path: string) {
  const method = request.method.toUpperCase();
  if (path === "/admin/menu" && method === "GET") {
    return handle(async () => {
      await admin(request, true);
      return { items: await adminMenu() };
    });
  }
  if ((path === "/admin/menu" && method === "POST") ||
      (/^\/admin\/menu\/[^/]+$/.test(path) && method === "PATCH")) {
    return handle(async () => {
      origin(request);
      const user = await admin(request, true);
      if (!request.headers.get("content-type")?.startsWith("multipart/form-data")) {
        throw new BookingError("INVALID_INPUT", 415);
      }
      const length = Number(request.headers.get("content-length") || 0);
      if (length > 5 * 1024 * 1024 + 64_000) throw new BookingError("IMAGE_TOO_LARGE", 413);
      const form = await request.formData();
      let item: unknown;
      try { item = JSON.parse(String(form.get("item") || "")); }
      catch { throw new BookingError("INVALID_INPUT", 400); }
      const parsed = menuItemSchema.parse(item);
      if (path === "/admin/menu" && parsed.id) throw new BookingError("INVALID_INPUT", 400);
      if (path !== "/admin/menu") {
        const pathId = decodeURIComponent(path.slice("/admin/menu/".length));
        if (parsed.id && parsed.id !== pathId) throw new BookingError("INVALID_INPUT", 400);
        parsed.id = pathId;
      }
      const candidate = form.get("image");
      const image = candidate instanceof File && candidate.size ? await optimizeMenuImage(candidate) : undefined;
      return { item: await saveMenuItem(parsed, user.id, image) };
    });
  }
  return response({ error: "NOT_FOUND" }, 404);
}

async function menuImageResponse(path: string) {
  const id = decodeURIComponent(path.slice("/menu/images/".length));
  try {
    const image = await menuImage(id);
    return new Response(new Uint8Array(image.bytes), {
      headers: {
        "Content-Type": image.type,
        "Cache-Control": "public, max-age=300, stale-while-revalidate=86400",
        ETag: `"${image.updatedAt}"`,
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    if (error instanceof BookingError && error.status === 404) return response({ error: "NOT_FOUND" }, 404);
    throw error;
  }
}

Deno.serve(async (request) => {
  const requestOrigin = request.headers.get("origin");
  if (request.method === "OPTIONS") {
    if (!requestOrigin || requestOrigin !== allowedOrigin()) return new Response(null, { status: 403 });
    return cors(new Response(null, { status: 204 }), requestOrigin);
  }
  try {
    if (requestOrigin && requestOrigin !== allowedOrigin()) return cors(response({ error: "FORBIDDEN" }, 403), requestOrigin);
    const path = apiPath(new URL(request.url));
    const publicImage = request.method === "GET" && /^\/menu\/images\/[a-z0-9-]+$/.test(path);
    if (publicImage) return cors(await menuImageResponse(path), requestOrigin);
    if (path === "/admin/menu" || path.startsWith("/admin/menu/")) return cors(await menuAdmin(request, path), requestOrigin);
    const module = routeModule(path, request.method.toUpperCase());
    if (!module) return cors(response({ error: "NOT_FOUND" }, 404), requestOrigin);
    const method = request.method.toUpperCase() as "GET" | "POST" | "PATCH" | "PUT" | "DELETE";
    const handler = (module as unknown as Record<string, (
      request: Request,
      context?: { params: Promise<{ id: string }> },
    ) => Promise<Response>>)[method];
    if (typeof handler !== "function") return cors(response({ error: "METHOD_NOT_ALLOWED" }, 405), requestOrigin);
    const reservationId = path.match(/^\/admin\/reservations\/([^/]+)$/)?.[1];
    const orderId = path.match(/^\/admin\/orders\/([^/]+)$/)?.[1];
    const id = reservationId || orderId;
    const result = id
      ? await handler(request, { params: Promise.resolve({ id }) })
      : await handler(request);
    return cors(result, requestOrigin);
  } catch (error) {
    console.error("BARAKA edge request failed", error instanceof Error ? error.name : "UnknownError");
    return cors(response({ error: "UNAVAILABLE" }, 503), requestOrigin);
  }
});
