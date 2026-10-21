"use client";
import { createContext, useContext, useState, type ReactNode } from "react";
import { LANGUAGE_COOKIE, publicText, translatedFlavor, type PublicLanguage } from "../lib/public-language";
export function usePublicLanguage(initialLanguage: PublicLanguage) {
  const [language, setLanguageState] = useState(initialLanguage);
  function setLanguage(value: PublicLanguage) {
    setLanguageState(value);
    document.cookie = `${LANGUAGE_COOKIE}=${value}; Path=/; Max-Age=31536000; SameSite=Lax${location.protocol === "https:" ? "; Secure" : ""}`;
  }
  return { language, setLanguage, t: (text: string) => publicText(language, text), flavor: (text: string) => translatedFlavor(text, language) };
}
const LanguageContext = createContext({ language: "ro" as PublicLanguage, setLanguage: (_value: PublicLanguage) => {}, t: (text: string) => text, flavor: (text: string) => text });
export const usePortalLanguage = () => useContext(LanguageContext);
export function PublicLanguageProvider({ initialLanguage, children }: { initialLanguage: PublicLanguage; children: ReactNode }) {
  const value = usePublicLanguage(initialLanguage);
  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}
export function LanguageSelector({ language, setLanguage }: { language: PublicLanguage; setLanguage: (value: PublicLanguage) => void }) {
  return <div className="feedback-languages" data-language={language} role="group" aria-label="Limba / Язык">{(["ro", "ru"] as const).map((lang) => <button key={lang} type="button" className="button language-option" aria-pressed={language === lang} onClick={() => setLanguage(lang)}>{lang.toUpperCase()}</button>)}</div>;
}
