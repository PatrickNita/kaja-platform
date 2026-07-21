"use client";

import { useEffect, useRef, type ReactNode } from "react";

export function MerchGrid({ children }: { children: ReactNode }) {
  const grid = useRef<HTMLDivElement>(null);
  const previousBodyOverflow = useRef<string | null>(null);
  const previousFocus = useRef<HTMLElement | null>(null);

  useEffect(() => {
    const element = grid.current;
    if (!element) return;

    const entries = () => Array.from(element.querySelectorAll<HTMLDetailsElement>(".merch-grid > .card-wrap .entry-card"));
    const clearModal = () => {
      element.classList.remove("merch-modal-open");
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
      cards.forEach((card) => card.classList.remove("merch-card-modal"));
      const active = entries().find((entry) => entry.open);
      if (!active) {
        clearModal();
        return;
      }

      const card = active.closest<HTMLElement>(".card-wrap");
      if (!card) return;
      card.classList.add("merch-card-modal");
      element.classList.add("merch-modal-open");
      active.setAttribute("role", "dialog");
      active.setAttribute("aria-modal", "true");
      if (previousBodyOverflow.current === null) {
        previousBodyOverflow.current = document.body.style.overflow;
        previousFocus.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
        document.body.style.overflow = "hidden";
        requestAnimationFrame(() => card.querySelector<HTMLElement>("[data-merch-close]")?.focus());
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
      if ((event.target as HTMLElement).closest("[data-merch-close]")) {
        event.preventDefault();
        closeActive();
      }
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") closeActive();
    };
    const backdrop = element.querySelector<HTMLButtonElement>(".merch-modal-backdrop");

    element.addEventListener("toggle", handleToggle, true);
    element.addEventListener("click", handleClick);
    backdrop?.addEventListener("click", closeActive);
    document.addEventListener("keydown", handleKeyDown);
    syncModal();
    return () => {
      element.removeEventListener("toggle", handleToggle, true);
      element.removeEventListener("click", handleClick);
      backdrop?.removeEventListener("click", closeActive);
      document.removeEventListener("keydown", handleKeyDown);
      clearModal();
    };
  }, []);

  return <div ref={grid} className="merch-grid-shell"><button className="merch-modal-backdrop" type="button" aria-label="Închide produsul merch" /><div className="items card-grid merch-grid">{children}</div></div>;
}
