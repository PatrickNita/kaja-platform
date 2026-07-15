"use client";

import { useEffect, useState } from "react";

type Section = "updates" | "tasks" | "events" | "flavors" | "catalogue" | "merch" | "uploads";
type Brand = "kaja" | "hexenwerk";

export function MobileMenu({ brand, view, catalogue }: { brand: Brand; view: Section; catalogue: "live" | "upcoming" | "ideas" }) {
  const [open, setOpen] = useState(false);
  const [catalogueOpen, setCatalogueOpen] = useState(view === "catalogue");
  useEffect(() => {
    if (!open) return;
    const close = (event: KeyboardEvent) => { if (event.key === "Escape") setOpen(false); };
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", close);
    return () => { document.body.style.overflow = ""; window.removeEventListener("keydown", close); };
  }, [open]);
  const link = (nextBrand: Brand, nextView: Section, group = catalogue) => `/?brand=${nextBrand}&view=${nextView}${nextView === "catalogue" ? `&catalogue=${group}` : ""}`;
  return <div className="mobile-menu"><button className="mobile-menu-button" aria-expanded={open} aria-controls="mobile-navigation" onClick={() => setOpen(true)}>Menu</button>{open && <><button className="mobile-menu-overlay" aria-label="Close menu" onClick={() => setOpen(false)} /><aside className="mobile-drawer" id="mobile-navigation" aria-label="Workspace navigation"><div className="mobile-drawer-head"><b>Menu</b><button className="mobile-close" aria-label="Close menu" onClick={() => setOpen(false)}>×</button></div><div className="mobile-drawer-label">Brands</div><div className="mobile-brand-list"><a href={link("kaja", view)} className={brand === "kaja" ? "active" : undefined}>KAJA</a><a href={link("hexenwerk", view)} className={brand === "hexenwerk" ? "active" : undefined}>HEXENWERK</a></div><nav className="mobile-section-list">{(["updates", "tasks", "events", "flavors", "catalogue", "merch", "uploads"] as Section[]).map((entry) => entry === "catalogue" ? <div key={entry}><button className={view === "catalogue" ? "active" : undefined} onClick={() => setCatalogueOpen(!catalogueOpen)}>Catalogue <span>{catalogueOpen ? "−" : "+"}</span></button>{catalogueOpen && <div className="mobile-catalogue-list"><a href={link(brand, "catalogue", "live")} className={view === "catalogue" && catalogue === "live" ? "active" : undefined}>Live Catalogue</a><a href={link(brand, "catalogue", "upcoming")} className={view === "catalogue" && catalogue === "upcoming" ? "active" : undefined}>Upcoming</a><a href={link(brand, "catalogue", "ideas")} className={view === "catalogue" && catalogue === "ideas" ? "active" : undefined}>Ideas</a></div>}</div> : <a key={entry} href={link(brand, entry)} className={view === entry ? "active" : undefined}>{entry}</a>)}</nav></aside></>}</div>;
}
