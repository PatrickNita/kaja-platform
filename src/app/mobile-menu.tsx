"use client";

import { useEffect, useRef, useState } from "react";

type Section =
  | "b2b"
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
    return () => {
      document.body.style.overflow = previousOverflow;
      trigger.current?.focus();
      window.removeEventListener("keydown", close);
    };
  }, [open]);

  useEffect(() => {
    setMemberName(
      document
        .querySelector(".workspace-brand .identity")
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
      <button
        ref={trigger}
        className="mobile-menu-button"
        aria-expanded={open}
        aria-controls="mobile-navigation"
        onClick={() => setOpen(true)}
      >
        Meniu
      </button>
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
                ×
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
