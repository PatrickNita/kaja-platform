"use client";

import { useEffect } from "react";

export function OpenEntryFromHash() {
  useEffect(() => {
    const openTarget = () => {
      const hash = window.location.hash.slice(1);
      if (!hash) return;

      const target = document.getElementById(decodeURIComponent(hash));
      if (!(target instanceof HTMLDetailsElement)) return;

      target.open = true;
      requestAnimationFrame(() => target.scrollIntoView({ behavior: "smooth", block: "center" }));
    };

    openTarget();
    window.addEventListener("hashchange", openTarget);
    return () => window.removeEventListener("hashchange", openTarget);
  }, []);

  return null;
}
