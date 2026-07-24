"use client";

import { useEffect, useRef, useState } from "react";

type Section = "updates" | "tasks" | "events" | "catalogue" | "merch" | "information" | "uploads";
type Brand = "kaja" | "hexenwerk" | "virginia";
type ActivityFilter = "all" | Brand;
type CatalogueGroup = "live" | "upcoming" | "ideas";
type TaskView = "all" | "mine" | "history";
type TaskBrandFilter = "all" | Brand;

const brandLabels: Record<Brand, string> = { kaja: "KAJA", hexenwerk: "HEXENWERK", virginia: "VIRGINIA" };
const sectionLabels = { updates: "Propuneri", events: "Evenimente", merch: "Merch", information: "Informații", uploads: "Încărcări" } as const;

export function MobileMenu({ brand, view, catalogue, tasks, taskBrand, memberSlug, activity }: { brand: Brand; view: Section; catalogue: CatalogueGroup; tasks: TaskView; taskBrand: TaskBrandFilter; memberSlug: string; activity?: ActivityFilter }) {
  const [open, setOpen] = useState(false);
  const [catalogueOpen, setCatalogueOpen] = useState(view === "catalogue");
  const [tasksOpen, setTasksOpen] = useState(view === "tasks");
  const [brandOpen, setBrandOpen] = useState(false);
  const [memberName, setMemberName] = useState("Membru");
  const brandControl = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
        setBrandOpen(false);
      }
    };
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", close);
    return () => {
      document.body.style.overflow = "";
      window.removeEventListener("keydown", close);
    };
  }, [open]);

  useEffect(() => {
    const close = (event: PointerEvent) => {
      if (brandControl.current && !brandControl.current.contains(event.target as Node)) setBrandOpen(false);
    };
    document.addEventListener("pointerdown", close);
    return () => document.removeEventListener("pointerdown", close);
  }, []);

  useEffect(() => {
    setMemberName(document.querySelector(".workspace-brand .identity")?.textContent?.trim() || "Membru");
  }, []);

  const link = (nextBrand: Brand, nextView: Section, options: { catalogue?: CatalogueGroup; tasks?: TaskView; taskBrand?: TaskBrandFilter } = {}) => {
    const group = options.catalogue ?? catalogue;
    const taskView = options.tasks ?? tasks;
    const taskBrandFilter = options.taskBrand ?? taskBrand;
    return `/?brand=${nextBrand}&view=${nextView}${nextView === "catalogue" ? `&catalogue=${group}` : ""}${nextView === "tasks" ? `&tasks=${taskView}&taskBrand=${taskView === "history" ? "all" : taskBrandFilter}` : ""}${nextView === "updates" && activity ? `&activity=${activity}` : ""}`;
  };

  return <div className="mobile-menu">
    <button className="mobile-menu-button" aria-expanded={open} aria-controls="mobile-navigation" onClick={() => setOpen(true)}>Meniu</button>
    {open && <>
      <button className="mobile-menu-overlay" aria-label="Închide meniul" onClick={() => setOpen(false)} />
      <aside className="mobile-drawer" id="mobile-navigation" aria-label="Navigare spațiu de lucru">
        <div className="mobile-drawer-head"><b>Meniu</b><button className="mobile-close" aria-label="Închide meniul" onClick={() => setOpen(false)}>×</button></div>
        <div className="mobile-member-identity"><span className="dot" /> {memberName}</div>
        <div className="mobile-drawer-label">Brand</div>
        <div className="mobile-brand-control" ref={brandControl}>
          <button className="mobile-brand-trigger" aria-expanded={brandOpen} aria-haspopup="listbox" onClick={() => setBrandOpen(!brandOpen)}>{brandLabels[brand]}<span aria-hidden="true">{brandOpen ? "↑" : "↓"}</span></button>
          {brandOpen && <div className="mobile-brand-options" role="listbox" aria-label="Selectează brandul">{(Object.keys(brandLabels) as Brand[]).map((entry) => <a key={entry} role="option" aria-selected={brand === entry} className={brand === entry ? "active" : undefined} href={link(entry, view)} onClick={() => setBrandOpen(false)}>{brandLabels[entry]}<span>{brand === entry ? "●" : ""}</span></a>)}</div>}
        </div>
        <nav className="mobile-section-list">
          <a href={link(brand, "updates")} className={view === "updates" ? "active" : undefined}>{sectionLabels.updates}</a>
          <div>
            <button className={view === "tasks" ? "active" : undefined} onClick={() => setTasksOpen(!tasksOpen)}>Sarcini <span>{tasksOpen ? "−" : "+"}</span></button>
            {tasksOpen && <div className="mobile-submenu-list">
              <a href={link(brand, "tasks", { tasks: "all" })} className={view === "tasks" && tasks === "all" ? "active" : undefined}>Toate sarcinile</a>
              <a href={link(brand, "tasks", { tasks: "mine" })} className={view === "tasks" && tasks === "mine" ? "active" : undefined}>Sarcinile mele</a>
              {memberSlug === "patrick" && <a href={link(brand, "tasks", { tasks: "history", taskBrand: "all" })} className={view === "tasks" && tasks === "history" ? "active" : undefined}>Istoric sarcini</a>}
            </div>}
          </div>
          <a href={link(brand, "events")} className={view === "events" ? "active" : undefined}>{sectionLabels.events}</a>
          <div>
            <button className={view === "catalogue" ? "active" : undefined} onClick={() => setCatalogueOpen(!catalogueOpen)}>Catalog <span>{catalogueOpen ? "−" : "+"}</span></button>
            {catalogueOpen && <div className="mobile-submenu-list">
              <a href={link(brand, "catalogue", { catalogue: "live" })} className={view === "catalogue" && catalogue === "live" ? "active" : undefined}>Catalog activ</a>
              <a href={link(brand, "catalogue", { catalogue: "upcoming" })} className={view === "catalogue" && catalogue === "upcoming" ? "active" : undefined}>În curând</a>
              <a href={link(brand, "catalogue", { catalogue: "ideas" })} className={view === "catalogue" && catalogue === "ideas" ? "active" : undefined}>Idei</a>
            </div>}
          </div>
          <a href={link(brand, "merch")} className={view === "merch" ? "active" : undefined}>{sectionLabels.merch}</a>
          <a href={link(brand, "information")} className={view === "information" ? "active" : undefined}>{sectionLabels.information}</a>
          <a href={link(brand, "uploads")} className={view === "uploads" ? "active" : undefined}>{sectionLabels.uploads}</a>
        </nav>
      </aside>
    </>}
  </div>;
}
