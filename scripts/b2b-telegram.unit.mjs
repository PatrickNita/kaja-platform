import assert from "node:assert/strict";
import {
  notificationMessages,
  deliverNotification,
} from "../src/lib/b2b/telegram-delivery.ts";
const event = {
  kind: "created",
  orderId: 12,
  at: "2026-10-19T09:00:00Z",
  actor: "Patrick",
  location: { name: "Test", address: "Adresă fictivă" },
  lines: [
    {
      id: 1,
      name: "BRAIN FREEZE",
      flavor: "Gheață",
      quantity: 2,
      price: 40000,
    },
  ],
  previous: [],
  total: 80000,
};
const text = notificationMessages(event).join("\n");
assert.match(text, /COMANDĂ NOUĂ #12/);
assert.match(text, /12:00/);
assert.match(text, /2 buc\. × 400 MDL = 800 MDL/);
assert.match(text, /Plasată de: Patrick/);
assert.match(text, /IDNO: —/);
for (const kind of ["created", "edited"]) {
  const localText = notificationMessages({
    ...event,
    kind,
    actor: "Local",
    location: { ...event.location, idno: "1234567890123" },
  }).join("\n");
  assert(!/Plasată de|Modificată de/.test(localText));
  assert.match(localText, /IDNO: 1234567890123/);
}
assert.match(
  notificationMessages({ ...event, kind: "edited", actor: "Ionut" }).join("\n"),
  /Modificată de: Ionut/,
);
const edited = {
  ...event,
  kind: "edited",
  previous: event.lines,
  lines: [
    { ...event.lines[0], quantity: 3 },
    {
      id: 2,
      name: "C-TRICK",
      flavor: "Bomboane Lămâie",
      quantity: 1,
      price: 40000,
    },
  ],
  total: 160000,
};
assert.match(notificationMessages(edited).join("\n"), /2 → 3 buc\./);
assert.match(notificationMessages(edited).join("\n"), /0 → 1 buc\./);
assert.match(
  notificationMessages({ ...edited, lines: [], total: 0 }).join("\n"),
  /2 → 0 buc\./,
);
const long = {
  ...event,
  lines: Array.from({ length: 25 }, (_, i) => ({
    id: i,
    name: "N".repeat(160),
    flavor: "G".repeat(160),
    quantity: 10000,
    price: 40000,
  })),
  total: 1000000000,
};
assert(notificationMessages(long).length > 1);
assert(notificationMessages(long).every((part) => part.length <= 4096));
await assert.rejects(
  deliverNotification(1, async () => [], "token", ""),
  /configuration/,
);
assert(!text.includes("/acces/"));
console.log(
  "PASS: Telegram formatting, Chisinau time, changes, long orders, destination validation.",
);
