import { clientIp, handle, limit } from "@/lib/booking/http";
import { publicMenu } from "@/lib/menu/engine";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET(request: Request) {
  return handle(async () => {
    await limit("public-menu", clientIp(request), 900, 60);
    return { items: await publicMenu() };
  });
}
