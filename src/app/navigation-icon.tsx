export type NavigationSection = "activity" | "catalogue" | "b2b" | "feedback" | "tasks" | "events" | "merch" | "information" | "uploads" | "menu" | "cart" | "search" | "chevron" | "pin" | "lock" | "product" | "person";

const paths: Record<NavigationSection, string> = {
  cart: "M3 3h2l3 12h10l3-9H6 M9 20h.01 M18 20h.01",
  search: "M21 21l-5-5 M18 10a8 8 0 1 1-16 0 8 8 0 0 1 16 0Z",
  chevron: "m9 6 6 6-6 6",
  pin: "M20 10c0 6-8 12-8 12S4 16 4 10a8 8 0 0 1 16 0Z M15 10a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z",
  lock: "M5 10h14v11H5z M8 10V6a4 4 0 0 1 8 0v4 M12 14v3",
  product: "m12 3 9 5-9 5-9-5 9-5Z M3 8v9l9 5 9-5V8 M12 13v9",
  person: "M16 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0Z M4 22v-3a8 8 0 0 1 16 0v3Z",
  activity: "m13 2-9 12h7l-1 8L21 9h-8l0-7Z",
  catalogue: "m12 3 9 5-9 5-9-5 9-5Z M3 8v9l9 5 9-5V8 M12 13v9",
  b2b: "M3 10h18l-2-7H5l-2 7Z M4 10v11h16V10 M9 21v-7h6v7 M3 10a3 3 0 0 0 6 0 3 3 0 0 0 6 0 3 3 0 0 0 6 0",
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
