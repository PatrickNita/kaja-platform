import type { Location, Order, Status } from "./model";
export const shortStatus: Record<Status, string> = {
  placed: "Plasată",
  confirmed: "Confirmată",
  paid: "Achitată",
};
export const formatOrderDate = (date: string, language: "ro" | "ru" = "ro") =>
  new Intl.DateTimeFormat(language === "ru" ? "ru-RU" : "ro-RO", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Europe/Chisinau",
  }).format(new Date(date));
export function periodParts(date: string) {
  const parts = new Intl.DateTimeFormat("en-GB", {
    year: "numeric",
    month: "2-digit",
    timeZone: "Europe/Chisinau",
  }).formatToParts(new Date(date));
  return {
    year: parts.find((p) => p.type === "year")!.value,
    month: parts.find((p) => p.type === "month")!.value,
  };
}
export function historyOrders(orders: Order[], month: string, year: string) {
  return orders
    .filter((o) => {
      const p = periodParts(o.created_at);
      return (!month || month === p.month) && (!year || year === p.year);
    })
    .toSorted(
      (a, b) =>
        Date.parse(b.created_at) - Date.parse(a.created_at) || b.id - a.id,
    );
}
export function sortLocations(locations: Location[], sort: string) {
  return locations.toSorted(
    (a, b) =>
      (sort === "latest"
        ? (Date.parse(b.last_order_at ?? "") || 0) -
          (Date.parse(a.last_order_at ?? "") || 0)
        : 0) ||
      a.name.localeCompare(b.name, "ro") ||
      a.id - b.id,
  );
}
