"use client";
import {
  FormEvent,
  ReactNode,
  createContext,
  useContext,
  useEffect,
  useState,
} from "react";
import LanguageSwitcher, { useSiteLanguage } from "./SiteLanguage";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  apiFetch,
  clearDemoSession,
  demoAuthEnabled,
  demoSessionStorageKey,
  fetchDemoAccounts,
  saveApiSessionToken,
  saveDemoSession,
} from "@/lib/client/api";
type Session = {
  kind: "owner" | "guest";
  number: string | null;
  displayName: string;
};
function demoSession(account: { kind: "owner" | "guest"; number: string | null; displayName: string }): Session {
  return {
    kind: account.kind,
    number: account.kind === "guest" ? account.number || "DEMO" : null,
    displayName: account.displayName,
  };
}
const SessionContext = createContext<{
  session: Session | null;
  setSession: (s: Session | null) => void;
}>({ session: null, setSession: () => {} });
export const useEntrySession = () => useContext(SessionContext);
export default function EntryGate({ children }: { children: ReactNode }) {
  const path = usePathname();
  const { t } = useSiteLanguage();
  const [session, setSession] = useState<Session | null>(null),
    [loading, setLoading] = useState(true),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  useEffect(() => {
    if (demoAuthEnabled) {
      saveApiSessionToken(null);
      let active = true;
      const restore = async () => {
        try {
          const username = localStorage.getItem(demoSessionStorageKey);
          if (!username) return;
          const account = (await fetchDemoAccounts()).find((candidate) => candidate.username === username);
          if (active && account) setSession(demoSession(account));
          if (active && !account) clearDemoSession();
        } catch {
          if (active) setError("Demo login could not load the public users.json account list.");
        } finally {
          if (active) setLoading(false);
        }
      };
      void restore();
      return () => { active = false; };
    }
    apiFetch("/api/session", { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => setSession(d.session || null))
      .catch(() => setError("Unable to connect. Please try again."))
      .finally(() => setLoading(false));
  }, []);
  useEffect(() => {
    if (demoAuthEnabled || session?.kind !== "guest") return;
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
      if (demoAuthEnabled) {
        const accounts = await fetchDemoAccounts();
        const username = String(f?.get("username") || "").trim();
        const password = String(f?.get("password") || "");
        const account = kind === "guest"
          ? accounts.find((candidate) => candidate.kind === "guest")
          : accounts.find((candidate) => candidate.kind === "owner" && candidate.username === username && candidate.password === password);
        if (!account)
          throw new Error("Demo sign-in failed. Use an account listed in the public users.json file.");
        saveDemoSession(account.username);
        saveApiSessionToken(null);
        setSession(demoSession(account));
        const basePath = process.env.NEXT_PUBLIC_BASE_PATH || "";
        if (kind === "owner") window.location.assign(`${basePath}/admin/reservations/`);
        else
          window.location.assign(
            `${basePath}/guest/profile/?next=` +
              encodeURIComponent(path + window.location.search),
          );
        return;
      }
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
      if (demoAuthEnabled) {
        clearDemoSession();
        saveApiSessionToken(null);
        setSession(null);
        window.location.assign(`${process.env.NEXT_PUBLIC_BASE_PATH || ""}/`);
        return;
      }
      const r = await apiFetch("/api/session", { method: "DELETE" });
      if (!r.ok) throw new Error();
      saveApiSessionToken(null);
      window.location.assign(`${process.env.NEXT_PUBLIC_BASE_PATH || ""}/`);
    } catch {
      setError("Could not sign out. Please retry.");
      setBusy(false);
    }
  }
  const protectedPage = path.startsWith("/admin") || path.startsWith("/guest") || path === "/order" || path === "/order/";
  if (demoAuthEnabled && !protectedPage)
    return <SessionContext.Provider value={{ session, setSession }}>{children}</SessionContext.Provider>;
  if (loading)
    return (
      <main className="entry-screen">
        <p role="status">BARAKA · {t("Loading…", "불러오는 중…")}</p>
      </main>
    );
  if (session && (!path.startsWith("/admin") || session.kind === "owner"))
    return (
      <SessionContext.Provider value={{ session, setSession }}>
        <div className="session-bar">
          <LanguageSwitcher />
          <span>
            {session.displayName ||
              (session.kind === "owner" ? t("Owner") : `Guest ${session.number}`)}
          </span>
          {session.kind === "guest" && (
            <>
              <Link href="/guest/profile">{t("Edit name")}</Link>
              <Link href="/order">{t("Order now")}</Link>
            </>
          )}
          {session.kind === "owner" && (
            <>
              <Link href="/admin/reservations">{t("Reservations")}</Link>
              <Link href="/admin/orders">{t("Orders")}</Link>
              <Link href="/admin/my-page">{t("My Page")}</Link>
            </>
          )}
          <button disabled={busy} onClick={logout}>
            {t("Sign out")}</button>
          <span role="alert">{t(error)}</span>
        </div>
        {demoAuthEnabled && (
          <aside className="demo-only-notice" role="note">
            <strong>{t("DEMO ONLY — PUBLIC LOGIN")}</strong>
            <span>{t("This account does not securely protect or save reservations, orders, menu edits, profiles, or private records.")}</span>
          </aside>
        )}
        {children}
      </SessionContext.Provider>
    );
  return (
    <main className="entry-screen">
      <section className="entry-card">
        <LanguageSwitcher />
        <p className="eyebrow">BARAKA · SILK ROAD DINING</p>
        <h1>{t("Welcome to our table")}</h1>
        <p>환영합니다 · Welcome · Xush kelibsiz · Добро пожаловать</p>
        <p>
          {demoAuthEnabled
            ? t("Continue with a public guest demo account. Demo sign-in is not private or secure.")
            : t("Continue as a guest to explore the restaurant and reserve a table. Your guest number is created automatically.")}
        </p>
        {!path.startsWith("/admin") && (
          <button
            className="entry-guest"
            disabled={busy}
            onClick={() => login("guest")}
          >
            {t("Continue as guest", "비회원 입장")}
          </button>
        )}
        <form className="admin-login" onSubmit={(e) => login("owner", e)}>
          <h2>{demoAuthEnabled ? t("Owner demo sign-in") : t("Owner sign-in")}</h2>
          <label>
            {t("Username")}<input
              name="username"
              autoComplete="username"
              maxLength={100}
              required
            />
          </label>
          <label>
            {t("Password")}<input
              name="password"
              type="password"
              autoComplete="current-password"
              maxLength={256}
              required
            />
          </label>
          <button disabled={busy}>
            {busy ? t("Please wait…") : t("Sign in as owner")}
          </button>
        </form>
        {demoAuthEnabled && (
          <p className="demo-login-note" role="note">
            {t("Demo only: these usernames and passwords are public.")} <a href={`${process.env.NEXT_PUBLIC_BASE_PATH || ""}/users.json`}>{t("View users.json")}</a>. {t("Never enter real credentials or private information.")}
          </p>
        )}
        <p role="alert">{t(error)}</p>
        <small>{demoAuthEnabled
          ? t("Live bookings, orders, and dashboard changes need server-side storage and are not saved by this demo.")
          : t("Reserve online at any time, even when the owner is offline.")}</small>
      </section>
    </main>
  );
}
