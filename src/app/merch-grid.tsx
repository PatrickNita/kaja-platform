"use client";

import { useEffect, useRef, type ReactNode } from "react";

export function MerchGrid({ children }: { children: ReactNode }) {
  const grid = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const element = grid.current;
    if (!element) return;

    const entries = () => Array.from(element.querySelectorAll<HTMLDetailsElement>(":scope > .card-wrap .entry-card"));
    const syncLayout = () => {
      const cards = entries().map((entry) => entry.closest<HTMLElement>(".card-wrap")).filter((card): card is HTMLElement => card !== null);
      cards.forEach((card) => card.classList.remove("merch-card-active", "merch-card-row-peer"));

      const activeIndex = entries().findIndex((entry) => entry.open);
      if (activeIndex < 0) return;

      cards[activeIndex]?.classList.add("merch-card-active");
      if (!window.matchMedia("(min-width: 1024px)").matches) return;

      const rowStart = Math.floor(activeIndex / 4) * 4;
      cards.slice(rowStart, rowStart + 4).forEach((card, index) => {
        if (rowStart + index !== activeIndex) card.classList.add("merch-card-row-peer");
      });
    };
    const handleToggle = (event: Event) => {
      const entry = event.target;
      if (!(entry instanceof HTMLDetailsElement) || !entry.classList.contains("entry-card")) return;

      if (entry.open) entries().forEach((other) => {
        if (other !== entry) other.open = false;
      });
      syncLayout();
    };

    element.addEventListener("toggle", handleToggle, true);
    window.addEventListener("resize", syncLayout);
    syncLayout();
    return () => {
      element.removeEventListener("toggle", handleToggle, true);
      window.removeEventListener("resize", syncLayout);
    };
  }, []);

  return <div ref={grid} className="items card-grid merch-grid">{children}</div>;
}
