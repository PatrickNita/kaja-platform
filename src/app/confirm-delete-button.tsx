"use client";

import type { ReactNode } from "react";

export function ConfirmDeleteButton({ children, itemName, className = "button ghost danger" }: { children: ReactNode; itemName: string; className?: string }) {
  return <button type="submit" className={className} onClick={(event) => {
    if (!window.confirm(`Sigur vrei să ștergi „${itemName}”? Această acțiune nu poate fi anulată.`)) event.preventDefault();
  }}>{children}</button>;
}
