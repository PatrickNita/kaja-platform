"use client";
import { useRef, useState, type FormEvent } from "react";
import Image from "next/image";
import { NavigationIcon } from "../navigation-icon";
import { usePublicLanguage, LanguageSelector } from "../public-language";
import type { PublicLanguage } from "../../lib/public-language";
import type { FeedbackProduct } from "../../lib/feedback-model";

const messages = {
  ro: { label: "Comentariu anonim", hint: "Nu include nume, numere de telefon sau alte date personale.", send: "Trimite feedback", busy: "Se trimite…", success: "Mulțumim! Feedbackul tău a fost trimis.", error: "Mesajul nu a putut fi trimis. Încearcă din nou.", invalid: "Scrie între 1 și 2.000 de caractere și încearcă din nou. Dacă pagina a rămas deschisă mult timp, reîncarc-o.", limited: "Ai trimis prea multe mesaje. Încearcă din nou peste 10 minute." },
  ru: { label: "Анонимный комментарий", hint: "Не указывайте имена, номера телефонов и другие личные данные.", send: "Отправить отзыв", busy: "Отправка…", success: "Спасибо! Ваш отзыв отправлен.", error: "Не удалось отправить отзыв. Попробуйте ещё раз.", invalid: "Введите от 1 до 2 000 символов и повторите попытку. Если страница открыта давно, обновите её.", limited: "Слишком много сообщений. Попробуйте снова через 10 минут." },
};
export function PublicFeedbackForm({ product, challenge, initialLanguage = "ro" }: { product: FeedbackProduct; challenge: string; initialLanguage?: PublicLanguage }) {
  const { language, setLanguage, flavor } = usePublicLanguage(initialLanguage);
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<"error" | "invalid" | "limited" | null>(null);
  const submission = useRef<string | null>(null);
  const t = messages[language];
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy || sent) return;
    const website = String(new FormData(event.currentTarget).get("website") || "");
    setBusy(true); setError(null);
    submission.current ??= crypto.randomUUID();
    try {
      const response = await fetch("/api/feedback", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ product: product.id, body, challenge, website, requestId: submission.current }) });
      const data = await response.json();
      if (!response.ok) { setError(data.code === "limited" ? "limited" : data.code === "invalid" ? "invalid" : "error"); return; }
      setSent(true); setBody("");
    } catch { setError("error"); } finally { setBusy(false); }
  }
  return <section className="feedback-public-card" lang={language}>
    <header className="public-product-header"><Image className="logo" src="/kaja-logo.png" alt="KAJA" width={1024} height={240} priority /><LanguageSelector language={language} setLanguage={setLanguage} /></header>
    <div className="feedback-public-header">
      <h1 className="item-title">{product.name} <span className="feedback-secondary">- {flavor(product.flavor)}</span></h1>
    </div>
    {sent ? <p role="status" className="b2b-success">{t.success}</p> : <form onSubmit={submit} className="form">
      <label htmlFor="feedback-body">{t.label}</label><div className="feedback-textarea-wrap"><textarea id="feedback-body" placeholder={language === "ro" ? "Cum ți s-a părut produsul?" : "Как вам продукт?"} value={body} onChange={(event) => setBody(event.target.value)} required minLength={1} maxLength={2000} rows={4} disabled={busy} aria-describedby="feedback-hint feedback-counter" /><span id="feedback-counter" className="feedback-counter">{body.length}/2.000</span></div>
      <small id="feedback-hint">{language === "ro" ? "Nu include date personale." : "Не указывайте личные данные."}</small>
      <div className="feedback-trap" aria-hidden="true"><label>Website<input name="website" autoComplete="off" tabIndex={-1} /></label></div>
      {error && <p role="alert" className="b2b-error">{t[error]}</p>}
      <button className="button" disabled={busy || !body.trim()}>{busy ? t.busy : t.send}</button>
    </form>}
    <p className="feedback-anonymous-note"><NavigationIcon name="lock" />{language === "ro" ? "Feedbackul este anonim." : "Отзыв анонимный."}</p>
  </section>;
}
