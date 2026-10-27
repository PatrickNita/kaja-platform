"use client";

import { useEffect, useRef, useState } from "react";
import { NavigationIcon } from "./navigation-icon";

type Section =
  | "b2b"
  | "feedback"
  | "activity"
  | "tasks"
  | "events"
  | "catalogue"
  | "merch"
  | "information"
  | "uploads";
type CatalogueGroup = "live" | "upcoming" | "ideas";
type TaskView = "all" | "mine" | "history";

const sectionLabels = {
  activity: "ACTIVITATE",
  events: "Evenimente",
  merch: "Merch",
  information: "Informații",
  uploads: "Încărcări",
} as const;

export function MobileMenu({
  view,
  catalogue,
  tasks,
  memberSlug,
  brand,
}: {
  brand: string;
  view: Section;
  catalogue: CatalogueGroup;
  tasks: TaskView;
  memberSlug: string;
}) {
  const drawer = useRef<HTMLElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);
  const [catalogueOpen, setCatalogueOpen] = useState(view === "catalogue");
  const [tasksOpen, setTasksOpen] = useState(view === "tasks");
  const [memberName, setMemberName] = useState("Membru");

  useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    drawer.current?.querySelector<HTMLButtonElement>("button")?.focus();
    const close = (event: KeyboardEvent) => {
      if (event.key === "Tab") {
        const controls = [
          ...(drawer.current?.querySelectorAll<HTMLElement>(
            "a[href],button:not(:disabled)",
          ) ?? []),
        ];
        const first = controls[0],
          last = controls[controls.length - 1];
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last?.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first?.focus();
        }
      }
      if (event.key === "Escape") {
        setOpen(false);
      }
    };
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", close);
    const mobileViewport = window.matchMedia("(max-width: 800px)");
    const closeOnDesktop = () => {
      if (!mobileViewport.matches) setOpen(false);
    };
    mobileViewport.addEventListener("change", closeOnDesktop);
    return () => {
      document.body.style.overflow = previousOverflow;
      if (trigger.current?.getClientRects().length) trigger.current.focus();
      else document.querySelector<HTMLAnchorElement>(".workspace-nav a.active")?.focus({ preventScroll: true });
      window.removeEventListener("keydown", close);
      mobileViewport.removeEventListener("change", closeOnDesktop);
    };
  }, [open]);

  useEffect(() => {
    setMemberName(
      document
        .querySelector(".workspace-brand .identity > span:last-child")
        ?.textContent?.trim() || "Membru",
    );
  }, []);

  const link = (
    nextView: Section,
    options: { catalogue?: CatalogueGroup; tasks?: TaskView } = {},
  ) => {
    const group = options.catalogue ?? catalogue;
    const taskView = options.tasks ?? tasks;
    return `/?brand=${brand}&view=${nextView}${nextView === "catalogue" ? `&catalogue=${group}` : ""}${nextView === "tasks" ? `&tasks=${taskView}` : ""}`;
  };

  return (
    <div className="mobile-menu">
      <nav className="mobile-bottom-nav" aria-label="Navigare principală">
        {([
          { key: "activity", label: "Activitate", href: link("activity") },
          { key: "catalogue", label: "Catalog", href: link("catalogue") },
          { key: "b2b", label: "B2B", href: "/b2b" },
          { key: "feedback", label: "Feedback", href: "/feedback" },
        ] as const).map(({ key, label, href }) => <a key={key} href={href} className={view === key ? "active" : undefined} aria-current={view === key ? "page" : undefined}><NavigationIcon name={key} /><span>{label}</span></a>)}
      <button
        ref={trigger}
        className={`mobile-menu-button${open || !["activity", "catalogue", "b2b", "feedback"].includes(view) ? " active" : ""}`}
        aria-expanded={open}
        aria-controls="mobile-navigation"
        onClick={() => setOpen(true)}
      >
        <NavigationIcon name="menu" /><span>Meniu</span>
      </button>
      </nav>
      {open && (
        <>
          <button
            className="mobile-menu-overlay"
            aria-label="Închide meniul"
            onClick={() => setOpen(false)}
          />
          <aside
            ref={drawer}
            role="dialog"
            aria-modal="true"
            className="mobile-drawer"
            id="mobile-navigation"
            aria-label="Navigare spațiu de lucru"
          >
            <div className="mobile-drawer-head">
              <b>Meniu</b>
              <button
                className="mobile-close"
                aria-label="Închide meniul"
                onClick={() => setOpen(false)}
              >
                <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><path d="m6 6 12 12M18 6 6 18" /></svg>
              </button>
            </div>
            <div className="mobile-member-identity">
              <span className="dot" /> {memberName}
            </div>
            <nav className="mobile-section-list">
              <a
                href={link("activity")}
                className={view === "activity" ? "active" : undefined}
              >
                {sectionLabels.activity}
              </a>
              <div>
                <button
                  aria-expanded={tasksOpen}
                  className={view === "tasks" ? "active" : undefined}
                  onClick={() => setTasksOpen(!tasksOpen)}
                >
                  Sarcini <span>{tasksOpen ? "−" : "+"}</span>
                </button>
                {tasksOpen && (
                  <div className="mobile-submenu-list">
                    <a
                      href={link("tasks", { tasks: "all" })}
                      className={
                        view === "tasks" && tasks === "all"
                          ? "active"
                          : undefined
                      }
                    >
                      Toate sarcinile
                    </a>
                    <a
                      href={link("tasks", { tasks: "mine" })}
                      className={
                        view === "tasks" && tasks === "mine"
                          ? "active"
                          : undefined
                      }
                    >
                      Sarcinile mele
                    </a>
                    {memberSlug === "patrick" && (
                      <a
                        href={link("tasks", { tasks: "history" })}
                        className={
                          view === "tasks" && tasks === "history"
                            ? "active"
                            : undefined
                        }
                      >
                        Istoric sarcini
                      </a>
                    )}
                  </div>
                )}
              </div>
              <a
                href={link("events")}
                className={view === "events" ? "active" : undefined}
              >
                {sectionLabels.events}
              </a>
              <div>
                <button
                  aria-expanded={catalogueOpen}
                  className={view === "catalogue" ? "active" : undefined}
                  onClick={() => setCatalogueOpen(!catalogueOpen)}
                >
                  Catalog <span>{catalogueOpen ? "−" : "+"}</span>
                </button>
                {catalogueOpen && (
                  <div className="mobile-submenu-list">
                    <a
                      href={link("catalogue", { catalogue: "live" })}
                      className={
                        view === "catalogue" && catalogue === "live"
                          ? "active"
                          : undefined
                      }
                    >
                      Catalog activ
                    </a>
                    <a
                      href={link("catalogue", { catalogue: "upcoming" })}
                      className={
                        view === "catalogue" && catalogue === "upcoming"
                          ? "active"
                          : undefined
                      }
                    >
                      În curând
                    </a>
                    <a
                      href={link("catalogue", { catalogue: "ideas" })}
                      className={
                        view === "catalogue" && catalogue === "ideas"
                          ? "active"
                          : undefined
                      }
                    >
                      Idei de gusturi
                    </a>
                  </div>
                )}
              </div>
              <a
                href={link("merch")}
                className={view === "merch" ? "active" : undefined}
              >
                {sectionLabels.merch}
              </a>
              <a
                href={link("information")}
                className={view === "information" ? "active" : undefined}
              >
                {sectionLabels.information}
              </a>
              <a
                href={link("uploads")}
                className={view === "uploads" ? "active" : undefined}
              >
                {sectionLabels.uploads}
              </a>
              <a href="/feedback" className={view === "feedback" ? "active" : undefined}>Feedback</a>
              <a href="/b2b" className={view === "b2b" ? "active" : undefined}>
                B2B
              </a>
            </nav>
          </aside>
        </>
      )}
    </div>
  );
}
