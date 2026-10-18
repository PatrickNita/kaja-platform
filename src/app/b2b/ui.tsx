"use client";
import { useEffect, useRef, useId, type ReactNode } from "react";
export async function request(body: Record<string, unknown>) {
  const response = await fetch("/api/b2b", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  }).catch(() => {
    throw new Error(
      "Conexiunea a eșuat. Verifică internetul și încearcă din nou.",
    );
  });
  const result = await response.json().catch(() => null);
  if (!response.ok || !result)
    throw new Error(result?.error ?? "Operația nu a reușit. Încearcă din nou.");
  return result;
}
export function Feedback({
  error,
  success,
}: {
  error?: string;
  success?: string;
}) {
  return (
    <>
      {error && (
        <p className="b2b-error" role="alert">
          {error}
        </p>
      )}
      {success && (
        <p className="b2b-success" role="status">
          {success}
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
  className = "",
}: {
  className?: string;
  title?: string;
  children: ReactNode;
  onClose: () => void;
  busy: boolean;
}) {
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
      aria-labelledby={titleId}
      onCancel={(event) => {
        event.preventDefault();
        if (!busy) onClose();
      }}
    >
      <div className="b2b-dialog-head">
        <h3 id={titleId} className="item-title" tabIndex={-1}>
          {title}
        </h3>
        <button
          type="button"
          aria-label="Închide dialogul"
          disabled={busy}
          onClick={onClose}
        >
          ×
        </button>
      </div>
      {children}
    </dialog>
  );
}
