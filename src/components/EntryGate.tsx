"use client";
import {
  FormEvent,
  ReactNode,
  createContext,
  useContext,
  useEffect,
  useState,
} from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { apiFetch, saveApiSessionToken, staticSiteOnly } from "@/lib/client/api";
import { restaurant } from "@/data/restaurant";
type Session = {
  kind: "owner" | "guest";
  number: string | null;
  displayName: string;
};
const SessionContext = createContext<{
  session: Session | null;
  setSession: (s: Session | null) => void;
}>({ session: null, setSession: () => {} });
export const useEntrySession = () => useContext(SessionContext);
export default function EntryGate({ children }: { children: ReactNode }) {
  const path = usePathname();
  const [session, setSession] = useState<Session | null>(null),
    [loading, setLoading] = useState(true),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  useEffect(() => {
    if (staticSiteOnly) { setLoading(false); return; }
    apiFetch("/api/session", { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => setSession(d.session || null))
      .catch(() => setError("Unable to connect. Please try again."))
      .finally(() => setLoading(false));
  }, []);
  useEffect(() => {
    if (session?.kind !== "guest") return;
    let active = true;
    const refresh = async () => {
      try {
        const response = await apiFetch("/api/session", { cache: "no-store" });
        if (!response.ok) return;
        const data = await response.json();
        if (active) setSession(data.session || null);
      } catch { /* Keep the current view during temporary network failures. */ }
    };
    const timer = window.setInterval(refresh, 30000);
    window.addEventListener("focus", refresh);
    return () => {
      active = false;
      window.clearInterval(timer);
      window.removeEventListener("focus", refresh);
    };
  }, [session?.kind]);
  async function login(
    kind: "owner" | "guest",
    e?: FormEvent<HTMLFormElement>,
  ) {
    e?.preventDefault();
    const f = e ? new FormData(e.currentTarget) : null;
    setBusy(true);
    setError("");
    try {
      const r = await apiFetch("/api/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          kind,
          ...(f
            ? { username: f.get("username"), password: f.get("password") }
            : {}),
        }),
      });
      const d = await r.json();
      if (!r.ok)
        throw new Error(
          d.error === "INVALID_LOGIN"
            ? "Incorrect username or password."
            : d.error === "RATE_LIMITED"
              ? "Too many attempts. Please try again in 10 minutes."
              : d.error === "FORBIDDEN"
                ? "Sign-in was blocked for this website address. Open the restaurant's configured website address and try again."
                : "Sign-in is temporarily unavailable. Please try again later or contact the restaurant.",
        );
      saveApiSessionToken(d.accessToken || null);
      setSession(d);
      const basePath = process.env.NEXT_PUBLIC_BASE_PATH || "";
      if (kind === "owner") window.location.assign(`${basePath}/admin/reservations/`);
      else
        window.location.assign(
          `${basePath}/guest/profile/?next=` +
            encodeURIComponent(path + window.location.search),
        );
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function logout() {
    setBusy(true);
    try {
      const r = await apiFetch("/api/session", { method: "DELETE" });
      if (!r.ok) throw new Error();
      saveApiSessionToken(null);
      window.location.assign(`${process.env.NEXT_PUBLIC_BASE_PATH || ""}/`);
    } catch {
      setError("Could not sign out. Please retry.");
      setBusy(false);
    }
  }
  if (staticSiteOnly) {
    const protectedPage = path.startsWith("/admin") || path.startsWith("/guest") || path === "/order" || path === "/order/" || path.startsWith("/book-a-table");
    if (!protectedPage)
      return <SessionContext.Provider value={{ session: null, setSession }}>{children}</SessionContext.Provider>;
    return (
      <main className="entry-screen"><section className="entry-card">
        <p className="eyebrow">BARAKA</p>
        <h1>{path.startsWith("/admin") ? "Owner sign-in is not available online yet" : "Please contact the restaurant"}</h1>
        <p>Online reservations and ordering are not available yet. You can still browse our menu and contact us directly.</p>
        <p><a href={restaurant.phoneHref}>{restaurant.phone}</a></p>
        <Link className="button button-green" href="/">Browse the restaurant</Link>
      </section></main>
    );
  }
  if (loading)
    return (
      <main className="entry-screen">
        <p role="status">BARAKA · Loading…</p>
      </main>
    );
  if (session && (!path.startsWith("/admin") || session.kind === "owner"))
    return (
      <SessionContext.Provider value={{ session, setSession }}>
        <div className="session-bar">
          <span>
            {session.displayName ||
              (session.kind === "owner" ? "Owner" : `Guest ${session.number}`)}
          </span>
          {session.kind === "guest" && (
            <>
              <Link href="/guest/profile">Edit name</Link>
              <Link href="/order">Order now</Link>
            </>
          )}
          {session.kind === "owner" && (
            <>
              <Link href="/admin/reservations">Reservations</Link>
              <Link href="/admin/orders">Orders</Link>
              <Link href="/admin/my-page">My Page</Link>
            </>
          )}
          <button disabled={busy} onClick={logout}>
            Sign out
          </button>
          <span role="alert">{error}</span>
        </div>
        {children}
      </SessionContext.Provider>
    );
  return (
    <main className="entry-screen">
      <section className="entry-card">
        <p className="eyebrow">BARAKA · SILK ROAD DINING</p>
        <h1>Welcome to our table</h1>
        <p>환영합니다 · Welcome · Xush kelibsiz · Добро пожаловать</p>
        <p>
          Continue as a guest to explore the restaurant and reserve a table.
          Your guest number is created automatically.
        </p>
        {!path.startsWith("/admin") && (
          <button
            className="entry-guest"
            disabled={busy}
            onClick={() => login("guest")}
          >
            Continue as guest · 비회원 입장
          </button>
        )}
        <form className="admin-login" onSubmit={(e) => login("owner", e)}>
          <h2>Owner sign-in</h2>
          <label>
            Username
            <input
              name="username"
              autoComplete="username"
              maxLength={100}
              required
            />
          </label>
          <label>
            Password
            <input
              name="password"
              type="password"
              autoComplete="current-password"
              maxLength={256}
              required
            />
          </label>
          <button disabled={busy}>
            {busy ? "Please wait…" : "Sign in as owner"}
          </button>
        </form>
        <p role="alert">{error}</p>
        <small>
          Reserve online at any time, even when the owner is offline.
        </small>
      </section>
    </main>
  );
}
