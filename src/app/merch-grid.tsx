"use client";

import { useEffect, useRef, type ReactNode } from "react";

export function ModalEntryGrid({ children, label, twoColumnMobile = false }: { children: ReactNode; label: string; twoColumnMobile?: boolean }) {
  const grid = useRef<HTMLDivElement>(null);
  const previousBodyOverflow = useRef<string | null>(null);
  const previousFocus = useRef<HTMLElement | null>(null);

  useEffect(() => {
    const element = grid.current;
    if (!element) return;

    const entries = () => Array.from(element.querySelectorAll<HTMLDetailsElement>(".modal-entry-grid > .card-wrap .entry-card"));
    const clearModal = () => {
      element.classList.remove("entry-modal-open");
      entries().forEach((entry) => entry.closest<HTMLElement>(".card-wrap")?.classList.remove("entry-card-modal"));
      entries().forEach((entry) => {
        entry.removeAttribute("role");
        entry.removeAttribute("aria-modal");
      });
      if (previousBodyOverflow.current !== null) {
        document.body.style.overflow = previousBodyOverflow.current;
        previousBodyOverflow.current = null;
      }
      previousFocus.current?.focus();
      previousFocus.current = null;
    };
    const syncModal = () => {
      const cards = entries().map((entry) => entry.closest<HTMLElement>(".card-wrap")).filter((card): card is HTMLElement => card !== null);
      cards.forEach((card) => card.classList.remove("entry-card-modal"));
      const active = entries().find((entry) => entry.open);
      if (!active) {
        clearModal();
        return;
      }

      const card = active.closest<HTMLElement>(".card-wrap");
      if (!card) return;
      card.classList.add("entry-card-modal");
      element.classList.add("entry-modal-open");
      active.setAttribute("role", "dialog");
      active.setAttribute("aria-modal", "true");
      if (previousBodyOverflow.current === null) {
        previousBodyOverflow.current = document.body.style.overflow;
        previousFocus.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
        document.body.style.overflow = "hidden";
        requestAnimationFrame(() => card.querySelector<HTMLElement>("[data-entry-close]")?.focus());
      }
    };
    const closeActive = () => {
      const active = entries().find((entry) => entry.open);
      if (active) active.open = false;
      syncModal();
    };
    const handleToggle = (event: Event) => {
      const entry = event.target;
      if (!(entry instanceof HTMLDetailsElement) || !entry.classList.contains("entry-card")) return;

      if (entry.open) entries().forEach((other) => {
        if (other !== entry) other.open = false;
      });
      syncModal();
    };
    const handleClick = (event: MouseEvent) => {
      if ((event.target as HTMLElement).closest("[data-entry-close]")) {
        event.preventDefault();
        closeActive();
      }
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") closeActive();
    };
    const backdrop = element.querySelector<HTMLButtonElement>(".entry-modal-backdrop");

    const entryElements = entries();
    entryElements.forEach((entry) => entry.addEventListener("toggle", handleToggle));
    element.addEventListener("click", handleClick);
    backdrop?.addEventListener("click", closeActive);
    document.addEventListener("keydown", handleKeyDown);
    syncModal();
    return () => {
      entryElements.forEach((entry) => entry.removeEventListener("toggle", handleToggle));
      element.removeEventListener("click", handleClick);
      backdrop?.removeEventListener("click", closeActive);
      document.removeEventListener("keydown", handleKeyDown);
      clearModal();
    };
  }, []);

  return <div ref={grid} className="modal-entry-grid-shell"><button className="entry-modal-backdrop" type="button" aria-label={`Închide ${label}`} /><div className={`items card-grid modal-entry-grid${twoColumnMobile ? " two-column-mobile" : ""}`}>{children}</div></div>;
}
