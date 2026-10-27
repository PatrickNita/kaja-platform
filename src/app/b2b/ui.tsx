"use client";
import { useEffect, useRef, useId, type ReactNode } from "react";
import { B2BRequestError, translatedError } from "../../lib/b2b/errors";
import { usePortalLanguage } from "../public-language";
export async function request(body: Record<string, unknown>) {
  const response = await fetch("/api/b2b", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  }).catch(() => {
    throw new B2BRequestError("Conexiunea a eșuat. Verifică internetul și încearcă din nou.", "network");
  });
  const result = await response.json().catch(() => null);
  if (!response.ok || !result)
    throw new B2BRequestError(result?.error ?? "Operația nu a reușit. Încearcă din nou.", result?.errorCode ?? "failed");
  return result;
}
export function Feedback({
  error,
  success,
}: {
  error?: string;
  success?: string;
}) {
  const { language, t } = usePortalLanguage();
  return (
    <>
      {error && (
        <p className="b2b-error" role="alert">
          {t(translatedError(error, language))}
        </p>
      )}
      {success && (
        <p className="b2b-success" role="status">
          {t(success)}
        </p>
      )}
    </>
  );
}
export function ConfirmDialog({
  children,
  onClose,
  busy,
  title = "Confirmă comanda",
  titleContent,
  subtitle,
  className = "",
}: {
  className?: string;
  title?: string;
  titleContent?: ReactNode;
  subtitle?: ReactNode;
  children: ReactNode;
  onClose: () => void;
  busy: boolean;
}) {
  const { t, language } = usePortalLanguage();
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    ref.current?.showModal();
    return () => {
      ref.current?.close();
      document.body.style.overflow = previousOverflow;
    };
  }, []);
  useEffect(() => {
    ref.current
      ?.querySelector<HTMLHeadingElement>("h3")
      ?.focus({ preventScroll: true });
  }, [title]);
  return (
    <dialog
      className={`entry-modal-surface b2b-dialog ${className}`}
      ref={ref}
      onKeyDown={event => event.stopPropagation()}
      lang={language}
      aria-labelledby={titleId}
      onClick={event => {
        if (event.target !== event.currentTarget || busy) return;
        const bounds=event.currentTarget.getBoundingClientRect();
        if(event.clientX<bounds.left || event.clientX>bounds.right || event.clientY<bounds.top || event.clientY>bounds.bottom) onClose();
      }}
      onCancel={(event) => {
        event.preventDefault();
        if (!busy) onClose();
      }}
    >
      <div className="b2b-dialog-head">
        <h3 id={titleId} className="item-title" tabIndex={-1}>
          {titleContent ?? t(title)}
          {subtitle && <span className="b2b-dialog-date"> — {subtitle}</span>}
        </h3>
        <button
          type="button"
          aria-label={t("Închide dialogul")}
          disabled={busy}
          onClick={onClose}
        >
          <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><path d="m6 6 12 12M18 6 6 18" /></svg>
        </button>
      </div>
      {children}
    </dialog>
  );
}
