"use client";
import Link from "next/link";
import { FormEvent, useCallback, useEffect, useRef, useState } from "react";
import { useEntrySession } from "./EntryGate";
import type { DiningOrder } from "@/lib/orders/validation";
import { apiFetch } from "@/lib/client/api";
type Menu = {
  id: string;
  name: string;
  ko: string;
  category: string;
  description: string;
  descriptionKo: string;
  price: number | null;
};
type Catalog = {
  open: boolean;
  tables: { id: string; name: string; seats: number }[];
  menu: Menu[];
};
export default function OrderPage() {
  const { session } = useEntrySession();
  const [lang, setLang] = useState<"en" | "ko">("ko"),
    [catalog, setCatalog] = useState<Catalog | null>(null),
    [table, setTable] = useState(""),
    [cart, setCart] = useState<Record<string, number>>({}),
    [category, setCategory] = useState("all"),
    [query, setQuery] = useState(""),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [orders, setOrders] = useState<DiningOrder[]>([]),
    [receipt, setReceipt] = useState<{
      queue_number: string;
      table_name: string;
    } | null>(null);
  const receiptNode = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (receipt) {
      receiptNode.current?.focus({ preventScroll: true });
      receiptNode.current?.scrollIntoView({
        block: "center",
        behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches
          ? "auto"
          : "smooth",
      });
    }
  }, [receipt]);
  const pending = useRef<{ fingerprint: string; key: string } | null>(null),
    refreshId = useRef(0);
  const t = (en: string, ko: string) => (lang === "ko" ? ko : en);
  const money = (n: number) =>
    new Intl.NumberFormat(lang === "ko" ? "ko-KR" : "en-US", {
      style: "currency",
      currency: "KRW",
      maximumFractionDigits: 0,
    }).format(n);
  useEffect(() => {
    try {
      const l = localStorage.getItem("baraka-language");
      if (l === "en" || l === "ko") setLang(l);
    } catch {}
  }, []);
  const loadCatalog = useCallback(async () => {
    try {
      const r = await apiFetch("/api/orders/catalog", { cache: "no-store" });
      if (!r.ok) throw new Error();
      const next: Catalog = await r.json();
      setCatalog(next);
      const activeIds = new Set(next.menu.map(item => item.id));
      setCart(current => Object.fromEntries(Object.entries(current).filter(([id]) => activeIds.has(id))));
    } catch {
      setError(
        "Unable to load ordering. Please refresh or ask a member of staff. / 주문 메뉴를 불러올 수 없습니다. 직원에게 문의해 주세요.",
      );
    }
  }, []);
  const refresh = useCallback(async () => {
    const id = ++refreshId.current;
    try {
      const r = await apiFetch("/api/orders", { cache: "no-store" });
      if (!r.ok) {
        if (r.status === 401) setOrders([]);
        return;
      }
      const d = await r.json();
      if (id === refreshId.current) setOrders(d.orders);
    } catch {
      /* Keep the last known order; never report a false cancellation. */
    }
  }, []);
  useEffect(() => {
    if (session?.kind !== "guest") return;
    void loadCatalog();
    void refresh();
    const timer = setInterval(() => {
      if (!document.hidden) { void refresh(); void loadCatalog(); }
    }, 5000);
    return () => clearInterval(timer);
  }, [session?.kind, loadCatalog, refresh]);
  if (session?.kind !== "guest")
    return (
      <main className="order-shell">
        <h1>Order at your table</h1>
        <p>Continue as a guest to place an order.</p>
        <Link href="/">Return to the restaurant</Link>
      </main>
    );
  const selected = catalog?.tables.find((x) => x.id === table);
  const lines = (catalog?.menu || []).filter((i) => cart[i.id] > 0);
  const totalCount = Object.values(cart).reduce((sum, q) => sum + q, 0);
  const total = lines.reduce((sum, i) => sum + (i.price || 0) * cart[i.id], 0);
  const change = (id: string, delta: number) => {
    setReceipt(null);
    setCart((previous) => {
      const next = Math.max(0, Math.min(20, (previous[id] || 0) + delta));
      if (delta > 0 && Object.values(previous).reduce((a, b) => a + b, 0) >= 60)
        return previous;
      return { ...previous, [id]: next };
    });
  };
  const categories = [
    ["all", "All dishes", "전체"],
    ["mains", "Mains", "메인"],
    ["grill", "Grill", "그릴"],
    ["soups", "Soups", "수프"],
    ["bakery", "Bakery", "빵"],
    ["salads", "Salads", "샐러드"],
    ["drinks", "Drinks", "음료"],
  ];
  const statuses: Record<string, string> = {
    queued: t("Received", "접수"),
    preparing: t("Preparing", "조리 중"),
    ready: t("Ready", "준비 완료"),
    served: t("Served", "제공 완료"),
    cancelled: t("Cancelled", "취소"),
  };
  async function submit(e: FormEvent) {
    e.preventDefault();
    if (busy) return;
    setError("");
    if (!table || !lines.length) {
      setError(
        t(
          "Select your table and at least one dish.",
          "테이블과 메뉴를 선택해 주세요.",
        ),
      );
      return;
    }
    const items = lines
      .map((i) => ({ menuId: i.id, quantity: cart[i.id] }))
      .sort((a, b) => a.menuId.localeCompare(b.menuId));
    const fingerprint = JSON.stringify({ tableId: table, items });
    const storageKey = `baraka-order-${session!.number}`;
    if (pending.current?.fingerprint !== fingerprint) {
      try {
        const saved = JSON.parse(sessionStorage.getItem(storageKey) || "null");
        pending.current = saved?.fingerprint === fingerprint ? saved : null;
      } catch {}
      if (!pending.current || pending.current.fingerprint !== fingerprint)
        pending.current = { fingerprint, key: crypto.randomUUID() };
    }
    try {
      sessionStorage.setItem(storageKey, JSON.stringify(pending.current));
    } catch {}
    setBusy(true);
    try {
      const r = await apiFetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tableId: table,
          items,
          idempotencyKey: pending.current!.key,
          website: "",
        }),
      });
      const d = await r.json();
      if (!r.ok) {
        const messages: Record<string, string> = {
          ORDERING_CLOSED: t(
            "Ordering is closed right now. Please ask staff.",
            "현재 주문할 수 없습니다. 직원에게 문의해 주세요.",
          ),
          TABLE_UNAVAILABLE: t(
            "This table is no longer available. Choose your table again.",
            "테이블을 다시 선택해 주세요.",
          ),
          MENU_CHANGED: t(
            "The menu changed. Refresh and select your dishes again.",
            "메뉴가 변경되었습니다. 새로고침 후 다시 선택해 주세요.",
          ),
          UNAUTHORIZED: t(
            "Your guest session expired. Sign out and continue as a guest again.",
            "세션이 만료되었습니다. 다시 비회원으로 입장해 주세요.",
          ),
          RATE_LIMITED: t(
            "Too many requests. Please wait before trying again.",
            "요청이 많습니다. 잠시 후 다시 시도해 주세요.",
          ),
          INVALID_INPUT: t(
            "Choose up to 30 dishes, 20 of each, and 60 portions in total.",
            "메뉴 30종, 메뉴별 20개, 총 60개까지 선택할 수 있습니다.",
          ),
        };
        throw new Error(
          messages[d.error] ||
            t(
              "We could not verify submission. Retry the same order to avoid duplicates.",
              "주문 결과를 확인하지 못했습니다. 같은 주문을 다시 시도해 주세요.",
            ),
        );
      }
      setReceipt(d.order);
      setCart({});
      pending.current = null;
      try {
        sessionStorage.removeItem(storageKey);
      } catch {}
      await refresh();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <main className="order-shell">
      <div className="order-heading">
        <div>
          <Link className="text-link" href="/">
            ← {t("Restaurant", "레스토랑")}
          </Link>
          <p className="eyebrow">BARAKA · AT YOUR TABLE</p>
          <h1>
            {t("Something delicious,", "맛있는 한 끼,")}
            <br />
            <em>{t("coming your way.", "테이블에서 주문하세요.")}</em>
          </h1>
          <p>
            {t("Ordering as", "주문자")} <strong>{session.displayName}</strong>{" "}
            · {t("Guest", "비회원")} {session.number}
          </p>
        </div>
        <label className="order-language">
          {t("Language", "언어")}
          <select
            value={lang}
            onChange={(e) => setLang(e.target.value as "en" | "ko")}
          >
            <option value="ko">한국어</option>
            <option value="en">English</option>
          </select>
        </label>
      </div>
      {!catalog ? (
        <p role="status">
          {t("Loading tables and menu…", "테이블과 메뉴를 불러오는 중…")}
        </p>
      ) : (
        <>
          <section className="order-table-section">
            <div className="order-section-title">
              <span>01</span>
              <h2>{t("Choose your table", "테이블 선택")}</h2>
            </div>
            <p>
              {t(
                "Select the table where you are seated.",
                "현재 앉아 계신 테이블을 선택해 주세요.",
              )}
            </p>
            <div className="order-table-grid">
              {catalog.tables.map((x) => (
                <button
                  key={x.id}
                  disabled={busy}
                  aria-pressed={table === x.id}
                  onClick={() => {
                    setTable(x.id);
                    setReceipt(null);
                  }}
                >
                  <strong>{x.name}</strong>
                  <small>{t(`Up to ${x.seats} seats`, `${x.seats}인석`)}</small>
                </button>
              ))}
            </div>
            {!catalog.tables.length && (
              <p>
                {t(
                  "Tables are not available. Please ask staff.",
                  "테이블을 선택할 수 없습니다. 직원에게 문의해 주세요.",
                )}
              </p>
            )}
            {!catalog.open && (
              <p role="status">
                {t(
                  "Ordering is currently closed.",
                  "현재 주문이 마감되었습니다.",
                )}
              </p>
            )}
          </section>
          {selected && (
            <div className="order-layout">
              <section>
                <div className="order-section-title">
                  <span>02</span>
                  <h2>{t("Choose your dishes", "메뉴 선택")}</h2>
                </div>
                <label className="order-search">
                  {t("Find a dish", "메뉴 검색")}
                  <input
                    type="search"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder={t("Plov, samsa, tea…", "필라프, 삼사, 차…")}
                  />
                </label>
                <nav
                  className="order-categories"
                  aria-label={t("Menu categories", "메뉴 분류")}
                >
                  {categories.map(([id, en, ko]) => (
                    <button
                      key={id}
                      onClick={() => setCategory(id)}
                      aria-pressed={category === id}
                    >
                      {t(en, ko)}
                    </button>
                  ))}
                </nav>
                <div className="order-menu-grid">
                  {catalog.menu
                    .filter(
                      (i) =>
                        (category === "all" || i.category === category) &&
                        `${i.name} ${i.ko}`
                          .toLowerCase()
                          .includes(query.toLowerCase()),
                    )
                    .map((i) => (
                      <article className="order-dish" key={i.id}>
                        <div>
                          <small>{t(i.ko, i.name)}</small>
                          <h3>{t(i.name, i.ko)}</h3>
                          <p>{t(i.description, i.descriptionKo)}</p>
                          <strong>
                            {i.price === null
                              ? t("Ask staff for price", "가격 문의")
                              : money(i.price)}
                          </strong>
                        </div>
                        <div className="order-quantity">
                          <button
                            type="button"
                            aria-label={`${t("Remove", "빼기")} ${t(i.name, i.ko)}`}
                            disabled={busy || !cart[i.id]}
                            onClick={() => change(i.id, -1)}
                          >
                            −
                          </button>
                          <output aria-label={`${t(i.name, i.ko)} quantity`}>
                            {cart[i.id] || 0}
                          </output>
                          <button
                            type="button"
                            aria-label={`${t("Add", "추가")} ${t(i.name, i.ko)}`}
                            disabled={
                              busy ||
                              (cart[i.id] || 0) >= 20 ||
                              totalCount >= 60
                            }
                            onClick={() => change(i.id, 1)}
                          >
                            +
                          </button>
                        </div>
                      </article>
                    ))}
                </div>
              </section>
              <aside id="order-checkout" className="order-cart">
                <form onSubmit={submit}>
                  <p className="eyebrow">
                    {selected.name} · {session.displayName}
                  </p>
                  <h2>{t("Your order", "주문 내역")}</h2>
                  {!lines.length ? (
                    <p>
                      {t("Add dishes from the menu.", "메뉴를 선택해 주세요.")}
                    </p>
                  ) : (
                    <ul>
                      {lines.map((i) => (
                        <li key={i.id}>
                          <span>
                            {cart[i.id]} × {t(i.name, i.ko)}
                          </span>
                          <strong>
                            {i.price === null
                              ? "—"
                              : money(i.price * cart[i.id])}
                          </strong>
                        </li>
                      ))}
                    </ul>
                  )}
                  <div className="order-total">
                    <span>{t("Menu estimate", "예상 금액")}</span>
                    <strong>
                      {lines.some((i) => i.price === null)
                        ? t("Confirm with staff", "직원에게 확인")
                        : money(total)}
                    </strong>
                  </div>
                  <small>
                    {t(
                      "Menu prices are indicative. Staff confirm current availability and the final bill at the restaurant.",
                      "메뉴 가격은 참고용입니다. 주문 가능 여부와 최종 금액은 직원이 확인합니다.",
                    )}
                  </small>
                  <button
                    className="order-submit"
                    disabled={busy || !catalog.open || !lines.length}
                  >
                    {busy
                      ? t("Sending…", "전송 중…")
                      : t("Complete order", "주문 완료")}
                  </button>
                </form>
              </aside>
            </div>
          )}
        </>
      )}
      <p className="order-error" role="alert">
        {error}
      </p>
      {error && !catalog && (
        <button onClick={() => void loadCatalog()}>
          {t("Try again", "다시 시도")}
        </button>
      )}
      {receipt && (
        <div
          ref={receiptNode}
          tabIndex={-1}
          className="order-success"
          role="status"
        >
          <h2>
            {t(
              `Order #${receipt.queue_number} received`,
              `주문 #${receipt.queue_number} 접수 완료`,
            )}
          </h2>
          <p>
            {receipt.table_name} ·{" "}
            {t(
              "The owner can see your order. Orders enter the kitchen queue in arrival order.",
              "주문이 전달되었습니다. 접수 순서대로 조리를 시작합니다.",
            )}
          </p>
        </div>
      )}
      {orders.length > 0 && (
        <section className="guest-orders">
          <h2>{t("Your orders", "내 주문")}</h2>
          <p>
            {t(
              "Status updates automatically. Times are in Korea Standard Time.",
              "주문 상태가 자동으로 갱신됩니다. 시간은 한국 표준시입니다.",
            )}
          </p>
          {orders.map((o) => (
            <article key={o.id}>
              <div>
                <strong>
                  #{o.queue_number} · {o.table_name}
                </strong>
                <span className={`order-status status-${o.status}`}>
                  {statuses[o.status]}
                </span>
              </div>
              <time dateTime={o.created_at}>
                {new Date(o.created_at).toLocaleString(
                  lang === "ko" ? "ko-KR" : "en-GB",
                  { timeZone: "Asia/Seoul", hour12: false },
                )}
              </time>
              <p>
                {o.items
                  .map((i) => `${i.quantity} × ${t(i.name, i.nameKo)}`)
                  .join(" · ")}
              </p>
            </article>
          ))}
        </section>
      )}
      {selected && totalCount > 0 && (
        <a className="order-mobile-cart" href="#order-checkout">
          {t("View order", "주문 내역 보기")} · {totalCount} ·{" "}
          {lines.some((i) => i.price === null)
            ? t("Confirm price", "가격 문의")
            : money(total)}
        </a>
      )}
    </main>
  );
}
