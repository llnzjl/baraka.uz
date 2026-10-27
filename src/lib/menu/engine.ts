import { randomBytes } from "node:crypto";
import { menuItems } from "@/data/menu";
import { transaction } from "@/lib/booking/db";
import { BookingError } from "@/lib/booking/validation";
import { z } from "zod";

export const menuItemSchema = z.object({
  id: z.string().regex(/^[a-z0-9][a-z0-9-]{0,79}$/).optional(),
  name: z.string().trim().min(1).max(100),
  ko: z.string().trim().min(1).max(100),
  category: z.enum(["mains", "grill", "soups", "bakery", "salads", "drinks"]),
  description: z.string().trim().max(500).default(""),
  descriptionKo: z.string().trim().max(500).default(""),
  price: z.number().int().min(0).max(5_000_000).nullable(),
  active: z.boolean().default(true),
}).strict();
export type MenuRecord = Omit<z.infer<typeof menuItemSchema>, "id"> & { id: string; image: string; updatedAt: string };
let seeded = false;

export async function ensureMenuSeeded(c: import("../booking/db").DatabaseClient) {
  if (seeded) return;
  await c.query("SELECT pg_advisory_xact_lock(739174202)");
  const existing = Number((await c.query("SELECT count(*)::int AS count FROM booking.restaurant_menu")).rows[0].count);
  if (existing >= menuItems.length) { seeded = true; return; }
  for (const item of menuItems) {
    await c.query(
      `INSERT INTO booking.restaurant_menu(id,name,name_ko,category,description,description_ko,price)
       VALUES($1,$2,$3,$4,$5,$6,$7) ON CONFLICT(id) DO NOTHING`,
      [item.id,item.name,item.ko,item.category,item.description,item.descriptionKo,item.price ?? null],
    );
  }
  seeded = true;
}
function imagePath(id: string, version: string | null, hasImage: boolean) {
  return hasImage ? `/api/menu/images/${encodeURIComponent(id)}?v=${encodeURIComponent(version || "1")}` : `/menu/${id}.jpg`;
}
function record(row: any): MenuRecord {
  return {
    id: row.id, name: row.name, ko: row.name_ko, category: row.category,
    description: row.description, descriptionKo: row.description_ko,
    price: row.price === null ? null : Number(row.price), active: row.active,
    image: imagePath(row.id,row.image_version,Boolean(row.has_image)),
    updatedAt: new Date(row.updated_at).toISOString(),
  };
}
const publicColumns = "id,name,name_ko,category,description,description_ko,price,active,updated_at,image_version,(image_data IS NOT NULL) AS has_image";
export async function publicMenu() {
  return transaction(async c => {
    await ensureMenuSeeded(c);
    const rows = await c.query(`SELECT ${publicColumns} FROM booking.restaurant_menu WHERE active ORDER BY category,name`);
    return rows.rows.map(record);
  });
}
export async function adminMenu() {
  return transaction(async c => {
    await ensureMenuSeeded(c);
    const rows = await c.query(`SELECT ${publicColumns} FROM booking.restaurant_menu ORDER BY category,name`);
    return rows.rows.map(record);
  });
}
export async function menuImage(id: string) {
  return transaction(async c => {
    const row = (await c.query("SELECT image_data,image_type,updated_at FROM booking.restaurant_menu WHERE id=$1 AND active",[id])).rows[0];
    if (!row?.image_data) throw new BookingError("NOT_FOUND",404);
    return { bytes: row.image_data as Buffer, type: row.image_type as string, updatedAt: new Date(row.updated_at).getTime() };
  });
}
export async function saveMenuItem(raw: unknown, actor: string, image?: { bytes: Buffer; type: string }) {
  const v = menuItemSchema.parse(raw);
  const id = v.id || `${v.name.toLocaleLowerCase().normalize("NFKD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g,"-").replace(/^-|-$/g,"").slice(0,60) || "dish"}-${randomBytes(4).toString("hex")}`;
  return transaction(async c => {
    await ensureMenuSeeded(c);
    const result = await c.query(
      `INSERT INTO booking.restaurant_menu(id,name,name_ko,category,description,description_ko,price,active,image_data,image_type)
       VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
       ON CONFLICT(id) DO UPDATE SET name=EXCLUDED.name,name_ko=EXCLUDED.name_ko,category=EXCLUDED.category,
       description=EXCLUDED.description,description_ko=EXCLUDED.description_ko,price=EXCLUDED.price,active=EXCLUDED.active,
       image_data=COALESCE(EXCLUDED.image_data,booking.restaurant_menu.image_data),
       image_type=COALESCE(EXCLUDED.image_type,booking.restaurant_menu.image_type),
       image_version=CASE WHEN EXCLUDED.image_data IS NULL THEN booking.restaurant_menu.image_version ELSE gen_random_uuid() END,
       updated_at=clock_timestamp()
       RETURNING ${publicColumns}`,
      [id,v.name,v.ko,v.category,v.description,v.descriptionKo,v.price,v.active,image?.bytes ?? null,image?.type ?? null],
    );
    await c.query("INSERT INTO booking.audit_log(actor,action) VALUES($1,$2)",[actor,`menu item saved: ${id}`]);
    return record(result.rows[0]);
  });
}
