"use client";

import { createPortal } from "react-dom";
import { useEffect, useLayoutEffect, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import { useEntryModalState } from "./entry-modal-state";

export function ModalEntryGrid({ children, entryIds, label, twoColumnMobile = false }: { children: ReactNode; entryIds: string[]; label: string; twoColumnMobile?: boolean }) {
  const { activeEntryId, closeEntry, openEntry, saving } = useEntryModalState();
  const entryIdsRef = useRef(entryIds);
  const savingRef = useRef(saving);
  const entrySignature = entryIds.join("|");

  useLayoutEffect(() => {
    entryIdsRef.current = entryIds;
  }, [entryIds, entrySignature]);

  useLayoutEffect(() => {
    savingRef.current = saving;
  }, [saving]);

  useEffect(() => {
    const openFromHash = () => {
      if (savingRef.current) return;
      const hash = window.location.hash.slice(1);
      if (!hash) {
        closeEntry();
        return;
      }

      let entryId: string;
      try {
        entryId = decodeURIComponent(hash);
      } catch {
        closeEntry();
        return;
      }

      if (entryIdsRef.current.includes(entryId)) openEntry(entryId);
      else closeEntry();
    };

    openFromHash();
    window.addEventListener("hashchange", openFromHash);
    const closeForFilter = () => {
      if (!savingRef.current) closeEntry();
    };
    window.addEventListener("workspace-filter-change", closeForFilter);
    return () => {
      window.removeEventListener("hashchange", openFromHash);
      window.removeEventListener("workspace-filter-change", closeForFilter);
    };
  }, [closeEntry, openEntry]);

  useEffect(() => {
    if (!saving && activeEntryId && !entryIdsRef.current.includes(activeEntryId)) closeEntry();
  }, [activeEntryId, closeEntry, entrySignature, saving]);

  return <div className="modal-entry-grid-shell" tabIndex={-1}><div className={`items card-grid modal-entry-grid${twoColumnMobile ? " two-column-mobile" : ""}`} aria-label={label}>{children}</div></div>;
}

export function ModalEntryCard({ children, entryId, label, preview }: { children: ReactNode; entryId: string; label: string; preview: ReactNode }) {
  const trigger = useRef<HTMLDivElement>(null);
  const modal = useRef<HTMLDivElement>(null);
  const [mounted, setMounted] = useState(false);
  const { activeEntryId, closeEntry, openEntry, saving } = useEntryModalState();
  const active = activeEntryId === entryId;

  useEffect(() => setMounted(true), []);

  useLayoutEffect(() => {
    if (!active) return;
    const previousOverflow = document.body.style.overflow;
    const layer = modal.current?.closest(".entry-modal-layer");
    const background = Array.from(document.body.children)
      .filter((element): element is HTMLElement => element instanceof HTMLElement && element !== layer)
      .map((element) => ({
        element,
        inert: element.hasAttribute("inert"),
        ariaHidden: element.getAttribute("aria-hidden"),
      }));

    document.body.style.overflow = "hidden";
    modal.current?.querySelector<HTMLElement>("[data-entry-close]")?.focus({ preventScroll: true });
    background.forEach(({ element }) => {
      element.setAttribute("inert", "");
      element.setAttribute("aria-hidden", "true");
    });

    return () => {
      document.body.style.overflow = previousOverflow;
      background.forEach(({ element, inert, ariaHidden }) => {
        if (!element.isConnected) return;
        if (!inert) element.removeAttribute("inert");
        if (ariaHidden === null) element.removeAttribute("aria-hidden");
        else element.setAttribute("aria-hidden", ariaHidden);
      });
      if (trigger.current?.isConnected) trigger.current.focus({ preventScroll: true });
      else document.querySelector<HTMLElement>(".modal-entry-grid-shell")?.focus({ preventScroll: true });
    };
  }, [active]);

  useLayoutEffect(() => {
    if (active && saving) modal.current?.focus({ preventScroll: true });
  }, [active, saving]);

  const open = () => openEntry(entryId);
  const close = () => {
    if (saving) return;
    closeEntry();
  };
  const handlePreviewKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== "Enter" && event.key !== " ") return;
    event.preventDefault();
    open();
  };
  const handleModalKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "Escape") {
      close();
      return;
    }
    if (event.key !== "Tab" || !modal.current) return;

    const focusable = Array.from(modal.current.querySelectorAll<HTMLElement>(
      'a[href], button:not([disabled]), textarea:not([disabled]), input:not([type="hidden"]):not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])',
    )).filter((element) => element.getClientRects().length > 0);
    if (focusable.length === 0) {
      event.preventDefault();
      modal.current.focus();
      return;
    }

    const first = focusable[0];
    const last = focusable.at(-1)!;
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  };

  return <>
    <div
      id={entryId}
      ref={trigger}
      className="entry-card-preview"
      role="button"
      tabIndex={0}
      aria-haspopup="dialog"
      aria-expanded={active}
      aria-label={`Deschide ${label}`}
      onClick={open}
      onKeyDown={handlePreviewKeyDown}
    >
      {preview}
    </div>
    {mounted && active && createPortal(
      <div className="entry-modal-layer">
        <button className="entry-modal-backdrop" type="button" aria-label={`Închide ${label}`} onClick={close} disabled={saving} />
        <div ref={modal} className="entry-modal-surface" role="dialog" aria-modal="true" aria-label={label} tabIndex={-1} onKeyDown={handleModalKeyDown}>
          {children}
        </div>
      </div>,
      document.body,
    )}
  </>;
}
