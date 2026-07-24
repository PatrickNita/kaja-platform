"use client";

import { useEffect, type ReactNode } from "react";
import { useFormStatus } from "react-dom";
import { useEntryModalState } from "./entry-modal-state";

export function ConfirmDeleteButton({ children, itemName, className = "button ghost danger" }: { children: ReactNode; itemName: string; className?: string }) {
  const { pending } = useFormStatus();
  const { setSaving } = useEntryModalState();

  useEffect(() => {
    if (!pending) return;
    setSaving(true);
    return () => setSaving(false);
  }, [pending, setSaving]);

  return <button type="submit" className={className} onClick={(event) => {
    if (!window.confirm(`Sigur vrei să ștergi „${itemName}”? Această acțiune nu poate fi anulată.`)) event.preventDefault();
  }} disabled={pending}>{pending ? "Se șterge…" : children}</button>;
}
