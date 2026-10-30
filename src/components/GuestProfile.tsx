"use client";
import { FormEvent, useState } from "react";
import LanguageSwitcher, { useSiteLanguage } from "./SiteLanguage";
import Link from "next/link";
import { useEntrySession } from "./EntryGate";
import { apiFetch, demoAuthEnabled } from "@/lib/client/api";

export default function GuestProfile() {
  const { session, setSession } = useEntrySession();
  const { t } = useSiteLanguage();
  const [name, setName] = useState(session?.displayName || ""),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  if (demoAuthEnabled)
    return (
      <main className="entry-screen">
        <section className="entry-card">
          <LanguageSwitcher />
          <p className="eyebrow">{t("DEMO ONLY")}</p>
          <h1>{t("Guest profiles are not saved")}</h1>
          <p>{t("This public demo login stores only the demo account name in this browser. Editing a real guest profile requires server-side storage.")}</p>
          <Link className="button button-green" href="/">{t("Return to the restaurant")}</Link>
        </section>
      </main>
    );
  if (session?.kind !== "guest")
    return (
      <main className="entry-screen">
        <section className="entry-card">
          <LanguageSwitcher />
          <h1>{t("Guest profile")}</h1>
          <p>{t("This page is for guest accounts.")}</p>
          <Link href="/">{t("Return to the restaurant")}</Link>
        </section>
      </main>
    );
  const defaultName = `Guest ${session.number}`;
  async function save(e?: FormEvent<HTMLFormElement>, keepDefault = false) {
    e?.preventDefault();
    setBusy(true);
    setError("");
    try {
      const r = await apiFetch("/api/session", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ displayName: keepDefault ? defaultName : name }),
      });
      const d = await r.json();
      if (!r.ok)
        throw new Error(
          r.status === 401
            ? "Your guest session has expired. Sign out and continue as a guest again."
            : r.status === 429
              ? "Too many changes. Please try again in a few minutes."
              : "Enter a name between 1 and 80 characters, without line breaks.",
        );
      setSession(d.session);
      const next = new URLSearchParams(window.location.search).get("next");
      const destination = next ? new URL(next, window.location.origin) : null;
      window.location.assign(
        destination?.origin === window.location.origin &&
          ["/", "/book-a-table", "/order"].includes(destination.pathname)
          ? destination.pathname + destination.search
          : "/",
      );
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  }
  return (
    <main className="entry-screen">
      <section className="entry-card">
          <LanguageSwitcher />
        <p className="eyebrow">{t("YOUR PLACE AT BARAKA")}</p>
        <h1>{t("What should we call you?")}</h1>
        <p>
          {t("Your default name is {name}. Keep it or choose a name for your reservations.").replace("{name}", defaultName)}
        </p>
        <form className="admin-login" onSubmit={(e) => void save(e)}>
          <label htmlFor="guest-display-name">
            {t("Your name")}<input
              id="guest-display-name"
              name="displayName"
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoComplete="nickname"
              maxLength={80}
              required
              disabled={busy}
            />
          </label>
          <button disabled={busy}>
            {busy ? t("Saving…") : t("Save name & continue")}
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => void save(undefined, true)}
          >
            {t("Use {name}").replace("{name}", defaultName)}
          </button>
        </form>
        <p role="alert">{t(error)}</p>
        <small>
          {t("You can change this later using “Edit name.” Your guest number stays the same for this session. Numbering restarts each day at midnight in Korea. The name appears in your reservation and the restaurant’s private records.")}</small>
      </section>
    </main>
  );
}
