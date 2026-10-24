import { getConfig, saveConfig } from "@/lib/booking/engine";
import { configSchema } from "@/lib/booking/validation";
import { handle, admin, body, origin } from "@/lib/booking/http";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET(request: Request) {
  return handle(async () => {
    await admin(request, true);
    return getConfig();
  });
}
export async function PATCH(request: Request) {
  return handle(async () => {
    origin(request);
    const user = await admin(request, true);
    return saveConfig(configSchema.parse(await body(request)), user.id);
  });
}
