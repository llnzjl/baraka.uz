"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/client/api";
export default function OwnerTabs() {
  const path = usePathname();
  const [waiting, setWaiting] = useState(0);
  useEffect(() => {
    let alive = true;
    async function refresh() {
      try {
        const r = await apiFetch("/api/admin/orders/count", { cache: "no-store" });
        if (r.ok) {
          const d = await r.json();
          if (alive) setWaiting(d.waiting);
        }
      } catch {}
    }
    void refresh();
    const timer = setInterval(() => {
      if (!document.hidden) void refresh();
    }, 5000);
    return () => {
      alive = false;
      clearInterval(timer);
    };
  }, []);
  return (
    <nav className="owner-tabs" aria-label="Owner sections">
      <Link
        href="/admin/reservations"
        aria-current={path === "/admin/reservations" ? "page" : undefined}
      >
        Reservations
      </Link>
      <Link
        href="/admin/orders"
        aria-current={path === "/admin/orders" ? "page" : undefined}
      >
        Orders{" "}
        {waiting > 0 && (
          <span
            className="order-count"
            aria-label={`${waiting} waiting orders`}
          >
            {waiting}
          </span>
        )}
      </Link>
      <Link href="/admin/menu" aria-current={path === "/admin/menu" ? "page" : undefined}>
        Menu
      </Link>
    </nav>
  );
}
