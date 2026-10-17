export const products = [
  ["BRAIN FREEZE", "Gheață"],
  ["C-TRICK", "Bomboane Lămâie"],
  ["CHA VERDE", "Ceai Verde"],
  ["STWY", "Căpșună"],
  ["HER PLEASURE", "Aperol"],
  ["GUAVERA", "Guava"],
  ["LTP", "Tartă de lămâie"],
  ["ALURE", "Aloe Vera"],
  ["2LATE", "Ciocolată"],
  ["BEE ELIXIR", "Miere de tei"],
  ["FUDGE IT", "Brownie"],
  ["LOVE ANDA", "Lavandă"],
  ["1st SIN", "Măr Verde"],
  ["POMPEI", "Pomelo"],
  ["GREEN & HAIRY", "Kiwi Smoothie"],
  ["JAMPRICOT", "Apricot Jam"],
  ["MONDAY MORNING", "Cafea"],
  ["SPOOKY", "Dovleac"],
  ["PEARADISE", "Pară"],
  ["MANSSI", "Mango Lassi"],
  ["CIN&MON", "Lapte Scorțișoară"],
  ["MON BLANC", "Iced Wine (Muscat)"],
  ["FOREST MASTER", "Vînăriță (Woodruff)"],
  ["CHCK", "Cheesecake"],
  ["NILLA", "Vanilie"],
] as const;
export type Status = "placed" | "confirmed" | "paid";
export const statusLabel: Record<Status, string> = {
  placed: "Comandă plasată",
  confirmed: "Comandă confirmată",
  paid: "Comandă achitată",
};
export const canManageOrders = (slug: string) =>
  slug === "patrick" || slug === "ionut";
export const canEditOrder = (status: Status, manager: boolean) =>
  status !== "paid" && (manager || status === "placed");
export const nextStatus = (status: Status): Status | null =>
  status === "placed" ? "confirmed" : status === "confirmed" ? "paid" : null;
export const money = (bani: number) =>
  new Intl.NumberFormat("ro-MD", { maximumFractionDigits: 2 }).format(
    bani / 100,
  ) + " MDL";
export type Product = {
  id: number;
  name: string;
  flavor: string;
  grams: number;
  price: number;
};
export type Location = {
  id: number;
  name: string;
  address: string;
  contact: string;
  phone: string;
  version: number;
  details_version: number;
  cashback: number;
  link?: string;
};
export type OrderItem = Product & { quantity: number };
export type Order = {
  id: number;
  location_id: number;
  location_name: string;
  location_snapshot: Pick<Location, "name" | "address" | "contact" | "phone">;
  author: string;
  status: Status;
  version: number;
  total: number;
  cashback: number;
  created_at: string;
  items: OrderItem[];
};
export type B2BData = {
  locations: Location[];
  products: Product[];
  orders: Order[];
};

export type StockStatus = "available" | "limited" | "unavailable";
export const stockStatus = (name: string): StockStatus =>
  name === "STWY"
    ? "unavailable"
    : name === "BRAIN FREEZE"
      ? "limited"
      : "available";
export const stockLabel: Record<StockStatus, string> = {
  available: "În stoc",
  limited: "Stoc limitat",
  unavailable: "Stoc epuizat",
};
export const stockLimit = (name: string, existingQuantity = 0) =>
  stockStatus(name) === "unavailable" ? existingQuantity : 10000;
