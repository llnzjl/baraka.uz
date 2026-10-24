import { z } from "zod";
export const orderSchema = z
  .object({
    tableId: z.string().uuid(),
    items: z
      .array(
        z
          .object({
            menuId: z.string().min(1).max(80),
            quantity: z.number().int().min(1).max(20),
          })
          .strict(),
      )
      .min(1)
      .max(30),
    idempotencyKey: z.string().uuid(),
    website: z.string().max(0).default(""),
  })
  .strict()
  .superRefine((v, ctx) => {
    if (new Set(v.items.map((i) => i.menuId)).size !== v.items.length)
      ctx.addIssue({
        code: "custom",
        path: ["items"],
        message: "Duplicate menu item",
      });
    if (v.items.reduce((n, i) => n + i.quantity, 0) > 60)
      ctx.addIssue({
        code: "custom",
        path: ["items"],
        message: "Maximum 60 portions per order",
      });
  });
export const orderStatusSchema = z
  .object({
    status: z.enum(["preparing", "ready", "served", "cancelled"]),
    version: z.number().int().positive(),
  })
  .strict();
export type OrderInput = z.infer<typeof orderSchema>;
export type OrderItem = {
  menuId: string;
  name: string;
  nameKo: string;
  quantity: number;
  unitPrice: number | null;
};
export type DiningOrder = {
  id: string;
  queue_number: string;
  reference: string;
  guest_number: string;
  guest_name: string;
  table_id: string;
  table_name: string;
  items: OrderItem[];
  estimated_total: number | null;
  status: "queued" | "preparing" | "ready" | "served" | "cancelled";
  version: number;
  created_at: string;
  updated_at: string;
  receipt?: null | {
    receipt_number: string;
    served_at: string;
    reference: string;
    table_name: string;
    guest_number: string;
    guest_name: string;
    items: OrderItem[];
    estimated_total: number | null;
  };
};
