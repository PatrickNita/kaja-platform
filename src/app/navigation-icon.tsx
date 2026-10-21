export type NavigationSection = "activity" | "catalogue" | "b2b" | "feedback" | "tasks" | "events" | "merch" | "information" | "uploads" | "menu";

const paths: Record<NavigationSection, string> = {
  activity: "M3 12h4l3-8 4 16 3-8h4",
  catalogue: "M4 4h6v6H4z M14 4h6v6h-6z M4 14h6v6H4z M14 14h6v6h-6z",
  b2b: "M3 21h18 M5 21V7l7-4 7 4v14 M9 21v-6h6v6 M9 9h.01 M15 9h.01",
  feedback: "M21 11a8 8 0 0 1-8 8H7l-4 3V11a8 8 0 0 1 8-8h2a8 8 0 0 1 8 8Z M8 10h8 M8 14h5",
  tasks: "M9 5h11 M9 12h11 M9 19h11 M3 5l1 1 2-2 M3 12l1 1 2-2 M3 19l1 1 2-2",
  events: "M4 5h16v16H4z M8 3v4 M16 3v4 M4 10h16",
  merch: "m8 3-6 4 3 5 3-2v11h8V10l3 2 3-5-6-4a4 4 0 0 1-8 0Z",
  information: "M12 17v-5 M12 8h.01 M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0Z",
  uploads: "M12 16V3 M7 8l5-5 5 5 M4 16v5h16v-5",
  menu: "M4 6h16 M4 12h16 M4 18h16",
};

export function NavigationIcon({ name }: { name: NavigationSection }) {
  return <svg className="navigation-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={paths[name]} /></svg>;
}
