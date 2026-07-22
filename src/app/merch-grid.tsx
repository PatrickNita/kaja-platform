"use client";

import { useLayoutEffect, useRef, type ReactNode } from "react";

export function ModalEntryGrid({ children, label, twoColumnMobile = false }: { children: ReactNode; label: string; twoColumnMobile?: boolean }) {
  const grid = useRef<HTMLDivElement>(null);
  const previousBodyOverflow = useRef<string | null>(null);
  const previousFocus = useRef<HTMLElement | null>(null);
  const activeEntryId = useRef<string | null>(null);
  const focusFrame = useRef<number | null>(null);

  useLayoutEffect(() => {
    const element = grid.current;
    if (!element) return;

    const entries = () => Array.from(element.querySelectorAll<HTMLDetailsElement>(".modal-entry-grid > .card-wrap .entry-card"));
    const entryById = (id: string) => entries().find((entry) => entry.id === id);

    const clearModal = ({ restoreFocus = true }: { restoreFocus?: boolean } = {}) => {
      if (focusFrame.current !== null) {
        cancelAnimationFrame(focusFrame.current);
        focusFrame.current = null;
      }

      activeEntryId.current = null;
      element.classList.remove("entry-modal-open");
      element.querySelectorAll<HTMLElement>(".card-wrap.entry-card-modal").forEach((card) => card.classList.remove("entry-card-modal"));
      entries().forEach((entry) => {
        entry.open = false;
        entry.removeAttribute("role");
        entry.removeAttribute("aria-modal");
      });

      if (previousBodyOverflow.current !== null) {
        document.body.style.overflow = previousBodyOverflow.current;
        previousBodyOverflow.current = null;
      }

      const focusTarget = previousFocus.current;
      previousFocus.current = null;
      if (!restoreFocus) return;

      if (focusTarget?.isConnected) {
        focusTarget.focus({ preventScroll: true });
        return;
      }

      element.focus({ preventScroll: true });
    };

    const openModal = (entry: HTMLDetailsElement, trigger?: HTMLElement, focusClose = true) => {
      const card = entry.closest<HTMLElement>(".card-wrap");
      if (!card || !entry.id) return;

      const isNewEntry = activeEntryId.current !== entry.id;
      entries().forEach((other) => {
        const otherCard = other.closest<HTMLElement>(".card-wrap");
        if (other !== entry) {
          other.open = false;
          other.removeAttribute("role");
          other.removeAttribute("aria-modal");
          otherCard?.classList.remove("entry-card-modal");
        }
      });

      if (isNewEntry) {
        previousFocus.current = trigger ?? entry.querySelector<HTMLElement>("summary") ?? (document.activeElement instanceof HTMLElement ? document.activeElement : null);
      }

      activeEntryId.current = entry.id;
      card.classList.add("entry-card-modal");
      element.classList.add("entry-modal-open");
      entry.setAttribute("role", "dialog");
      entry.setAttribute("aria-modal", "true");

      if (previousBodyOverflow.current === null) {
        previousBodyOverflow.current = document.body.style.overflow;
        document.body.style.overflow = "hidden";
      }

      // Apply the fixed modal classes before opening <details>, so the browser's
      // first painted frame is already centered instead of expanding in the grid.
      entry.open = true;

      if (focusClose) {
        if (focusFrame.current !== null) cancelAnimationFrame(focusFrame.current);
        focusFrame.current = requestAnimationFrame(() => {
          focusFrame.current = null;
          card.querySelector<HTMLElement>("[data-entry-close]")?.focus();
        });
      }
    };

    const closeActive = () => clearModal();

    const openFromHash = () => {
      const hash = window.location.hash.slice(1);
      if (!hash) {
        if (activeEntryId.current) clearModal();
        return;
      }

      let id: string;
      try {
        id = decodeURIComponent(hash);
      } catch {
        if (activeEntryId.current) clearModal();
        return;
      }

      const target = entryById(id);
      if (target) {
        openModal(target, target.querySelector<HTMLElement>("summary") ?? undefined);
      } else if (activeEntryId.current) {
        clearModal();
      }
    };

    const handleClick = (event: MouseEvent) => {
      const target = event.target;
      if (!(target instanceof Element)) return;

      if (target.closest("[data-entry-close]") || target.closest(".entry-modal-backdrop")) {
        event.preventDefault();
        closeActive();
        return;
      }

      const summary = target.closest<HTMLElement>("summary");
      const entry = summary?.parentElement;
      if (!(entry instanceof HTMLDetailsElement) || !entry.classList.contains("entry-card")) return;

      event.preventDefault();
      openModal(entry, summary ?? undefined);
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && activeEntryId.current) closeActive();
    };

    const observer = new MutationObserver(() => {
      const id = activeEntryId.current;
      if (!id) return;

      const active = entryById(id);
      if (!active) {
        // A successful delete removes the active entry during the RSC refresh.
        // Clear the backdrop and scroll lock in the same rendering turn.
        clearModal();
        return;
      }

      const card = active.closest<HTMLElement>(".card-wrap");
      if (!active.open || !card?.classList.contains("entry-card-modal") || !element.classList.contains("entry-modal-open")) {
        // Edits, comments and reactions may replace the server-rendered DOM.
        // Reattach the modal state to the replacement without moving focus.
        openModal(active, previousFocus.current ?? undefined, false);
      }
    });

    element.addEventListener("click", handleClick, true);
    document.addEventListener("keydown", handleKeyDown);
    window.addEventListener("hashchange", openFromHash);
    observer.observe(element, { childList: true, subtree: true });
    openFromHash();

    return () => {
      observer.disconnect();
      element.removeEventListener("click", handleClick, true);
      document.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("hashchange", openFromHash);
      clearModal({ restoreFocus: false });
    };
  }, []);

  return <div ref={grid} className="modal-entry-grid-shell" tabIndex={-1}><button className="entry-modal-backdrop" type="button" aria-label={`Închide ${label}`} /><div className={`items card-grid modal-entry-grid${twoColumnMobile ? " two-column-mobile" : ""}`}>{children}</div></div>;
}
