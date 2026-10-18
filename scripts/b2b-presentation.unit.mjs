import assert from "node:assert/strict";
import {
  historyOrders,
  periodParts,
  sortLocations,
} from "../src/lib/b2b/presentation.ts";
assert.deepEqual(periodParts("2025-12-31T22:30:00Z"), {
  year: "2026",
  month: "01",
});
assert.deepEqual(periodParts("2026-02-28T22:30:00Z"), {
  year: "2026",
  month: "03",
});
const orders = [
  { id: 1, created_at: "2025-12-31T22:30:00Z" },
  { id: 3, created_at: "2026-02-01T10:00:00Z" },
  { id: 2, created_at: "2026-02-01T10:00:00Z" },
  { id: 4, created_at: "2025-01-01T10:00:00Z" },
];
assert.deepEqual(
  historyOrders(orders, "", "").map((o) => o.id),
  [3, 2, 1, 4],
);
assert.deepEqual(
  historyOrders(orders, "01", "2026").map((o) => o.id),
  [1],
);
assert.deepEqual(
  historyOrders(orders, "01", "").map((o) => o.id),
  [1, 4],
);
assert.deepEqual(
  historyOrders(orders, "", "2025").map((o) => o.id),
  [4],
);
const venues = [
  { id: 1, name: "Zeta", last_order_at: null },
  { id: 2, name: "Alfa", last_order_at: "2026-01-01" },
  { id: 3, name: "Beta", last_order_at: "2026-02-01" },
];
assert.deepEqual(
  sortLocations(venues, "name").map((l) => l.id),
  [2, 3, 1],
);
assert.deepEqual(
  sortLocations(venues, "latest").map((l) => l.id),
  [3, 2, 1],
);
console.log(
  "PASS: history periods in Europe/Chisinau, year/month boundaries, descending order and venue sorting.",
);
