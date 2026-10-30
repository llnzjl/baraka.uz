"use client";

import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import { isLanguage, languageNames, siteLanguages, translate, type Language } from "@/lib/site-language";

const LanguageContext = createContext({ language: "ko" as Language, changeLanguage: (_language: Language) => {} });

export function SiteLanguageProvider({ children }: { children: ReactNode }) {
  const [language, setLanguage] = useState<Language>("ko");
  useEffect(() => {
    try {
      const saved = localStorage.getItem("baraka-language");
      if (isLanguage(saved)) setLanguage(saved);
    } catch { /* The language selector still works when storage is unavailable. */ }
    const sync = (event: StorageEvent) => {
      if (event.key === "baraka-language" && isLanguage(event.newValue)) setLanguage(event.newValue);
    };
    window.addEventListener("storage", sync);
    return () => window.removeEventListener("storage", sync);
  }, []);
  useEffect(() => { document.documentElement.lang = language; }, [language]);
  const changeLanguage = useCallback((next: Language) => {
    setLanguage(next);
    try { localStorage.setItem("baraka-language", next); } catch { /* Storage is optional. */ }
  }, []);
  return <LanguageContext.Provider value={{ language, changeLanguage }}>{children}</LanguageContext.Provider>;
}

export function useSiteLanguage() {
  const context = useContext(LanguageContext);
  const t = useCallback((en: string, ko?: string) => translate(context.language, en, ko), [context.language]);
  return { ...context, t };
}

export default function LanguageSwitcher() {
  const { language, changeLanguage, t } = useSiteLanguage();
  return <label className="language-switch">
    <span className="sr-only">{t("Language", "언어")}</span>
    <select value={language} onChange={event => { if (isLanguage(event.target.value)) changeLanguage(event.target.value); }}>
      {siteLanguages.map(code => <option key={code} value={code} lang={code}>{languageNames[code]}</option>)}
    </select>
  </label>;
}

export function RestaurantBackLink() {
  const { t } = useSiteLanguage();
  return <Link className="text-link" href="/">{t("Back to BARAKA", "BARAKA로 돌아가기")}</Link>;
}
