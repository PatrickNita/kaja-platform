// Run against a LOCAL test server and an isolated kaja_b2b_test_* database only.
import assert from "node:assert/strict";
import { createDecipheriv, createHmac, randomUUID } from "node:crypto";
import { neon } from "@neondatabase/serverless";
import { readFileSync } from "node:fs";

const base = process.env.B2B_TEST_BASE_URL ?? "http://127.0.0.1:3099";
assert.ok(
  ["localhost", "127.0.0.1"].includes(new URL(base).hostname),
  "Tests must target a local server",
);
const url = process.env.B2B_TEST_DATABASE_URL;
assert.ok(
  url && /^\/kaja_b2b_test_[a-f0-9]+$/.test(new URL(url).pathname),
  "An isolated test database is required",
);
const signing = process.env.B2B_TEST_SESSION_SECRET,
  key = process.env.B2B_TEST_KEY;
assert.ok(signing && key, "Local test keys are required");
const db = neon(url);
const member = (slug) =>
  `kaja_member=${slug}.${createHmac("sha256", signing).update(slug).digest("hex")}`;
const admin = member("patrick"),
  ionut = member("ionut"),
  igor = member("igor"),
  andrei = member("andrei");
let checks = 0;
async function api(cookie, payload, expected = 200) {
  const response = await fetch(base + "/api/b2b", {
    method: "POST",
    headers: { origin: base, "content-type": "application/json", cookie },
    body: JSON.stringify(payload),
  });
  const body = await response.json();
  assert.equal(
    response.status,
    expected,
    `Operation ${payload.operation}: ${body.error ?? response.status}`,
  );
  checks++;
  return body;
}
async function order(id) {
  const [row] = await db.query("select * from b2b_orders where id=$1", [id]);
  return row;
}
async function link(locationId) {
  const [row] = await db.query(
    "select token_cipher,version from b2b_locations where id=$1",
    [locationId],
  );
  const [iv, tag, data] = row.token_cipher
    .split(".")
    .map((v) => Buffer.from(v, "base64url"));
  const cipher = createDecipheriv("aes-256-gcm", Buffer.from(key, "hex"), iv);
  cipher.setAuthTag(tag);
  const token = Buffer.concat([cipher.update(data), cipher.final()]).toString();
  return `${base}/comenzi/acces/${locationId}/${token}`;
}
async function login(localLink) {
  const response = await fetch(localLink, { redirect: "manual" });
  assert.equal(response.status, 307);
  assert.equal(response.headers.get("location"), base + "/comenzi");
  checks++;
  return response.headers.get("set-cookie").split(";")[0];
}
const fields = {
  name: "Local test B2B",
  address: "Adresa test",
  contact: "Contact test",
  phone: "076000000",
};
await api("", { mode: "admin", operation: "createLocation", ...fields }, 403);
const a = (
  await api(igor, { mode: "admin", operation: "createLocation", ...fields })
).result.id;
const b = (
  await api(andrei, {
    mode: "admin",
    operation: "createLocation",
    ...fields,
    name: "Alt local test",
  })
).result.id;
const [catalog] = await db.query(
  "select count(*)::integer as count,min(price)::integer as price,min(grams)::integer as grams from b2b_products",
);
assert.deepEqual(catalog, { count: 25, price: 40000, grams: 200 });
checks++;
const [initial] = await db.query("select * from b2b_locations where id=$1", [
  a,
]);
await api(andrei, {
  mode: "admin",
  operation: "editLocation",
  locationId: a,
  version: initial.details_version,
  ...fields,
  name: "Local test actualizat",
});
const [afterEdit] = await db.query("select * from b2b_locations where id=$1", [
  a,
]);
assert.equal(afterEdit.token_cipher, initial.token_cipher);
assert.equal(afterEdit.version, initial.version);
checks++;
await api(
  andrei,
  {
    mode: "admin",
    operation: "editLocation",
    locationId: a,
    version: initial.details_version,
    ...fields,
  },
  409,
);
const oldLink = await link(a),
  localA = await login(oldLink),
  localB = await login(await link(b));
const manifest = JSON.parse(readFileSync(new URL('../.next/server/server-reference-manifest.json',import.meta.url),'utf8'));
for(const [actionId,action] of Object.entries(manifest.node??{})){
  if(!['workspaceData','taskWorkspaceData'].includes(action.exportedName))continue;
  const response=await fetch(base+'/',{method:'POST',headers:{origin:base,cookie:localA,'Next-Action':actionId,'Content-Type':'text/plain;charset=UTF-8'},body:JSON.stringify(action.exportedName==='workspaceData'?['all']:[])});
  assert.equal(response.status,200);
  assert.match(await response.text(),/\d+:null/,'B2B sessions must not receive internal server-action data');checks++;
}
await api(
  localA,
  { mode: "portal", operation: "createLocation", ...fields },
  403,
);
await api(
  igor,
  {
    mode: "admin",
    operation: "saveOrder",
    locationId: a,
    requestKey: randomUUID(),
    quantities: [{ productId: 1, quantity: 1 }],
  },
  403,
);
await api(
  andrei,
  {
    mode: "admin",
    operation: "rotateLink",
    locationId: a,
    version: 1,
    confirmed: true,
    invalidateSessions: true,
  },
  403,
);
const input = {
  mode: "portal",
  operation: "saveOrder",
  locationId: b,
  requestKey: randomUUID(),
  quantities: [
    { productId: 1, quantity: 2 },
    { productId: 25, quantity: 1 },
  ],
};
const results = await Promise.all([api(localA, input), api(localA, input)]);
const id = results[0].result.id;
assert.equal(id, results[1].result.id);
let row = await order(id);
assert.equal(row.location_id, a);
assert.equal(row.total, 120000);
assert.equal(row.author, "Local");
checks++;
await api(
  localB,
  {
    mode: "portal",
    operation: "saveOrder",
    orderId: id,
    version: row.version,
    quantities: [{ productId: 1, quantity: 8 }],
  },
  409,
);
await api(
  localA,
  {
    mode: "portal",
    operation: "saveOrder",
    orderId: id,
    version: row.version,
    quantities: [],
  },
  400,
);
await api(
  localA,
  {
    mode: "portal",
    operation: "saveOrder",
    orderId: id,
    version: row.version,
    quantities: [{ productId: 1, quantity: -1 }],
  },
  400,
);
await api(
  localA,
  {
    mode: "portal",
    operation: "saveOrder",
    orderId: id,
    version: row.version,
    quantities: [
      { productId: 1, quantity: 1 },
      { productId: 1, quantity: 2 },
    ],
  },
  400,
);
await api(
  admin,
  {
    mode: "admin",
    operation: "status",
    orderId: id,
    version: row.version,
    status: "paid",
  },
  409,
);
await api(
  igor,
  {
    mode: "admin",
    operation: "status",
    orderId: id,
    version: row.version,
    status: "confirmed",
  },
  403,
);
await api(localA, {
  mode: "portal",
  operation: "saveOrder",
  orderId: id,
  version: row.version,
  quantities: [{ productId: 1, quantity: 3 }],
});
row = await order(id);
const items = await db.query(
  "select product_id,quantity from b2b_order_items where order_id=$1",
  [id],
);
assert.deepEqual(items, [{ product_id: 1, quantity: 3 }]);
checks++;
await api(ionut, {
  mode: "admin",
  operation: "status",
  orderId: id,
  version: row.version,
  status: "confirmed",
});
row = await order(id);
await api(
  localA,
  {
    mode: "portal",
    operation: "saveOrder",
    orderId: id,
    version: row.version,
    quantities: [{ productId: 1, quantity: 5 }],
  },
  409,
);
await api(ionut, {
  mode: "admin",
  operation: "saveOrder",
  locationId: a,
  orderId: id,
  version: row.version,
  quantities: [{ productId: 2, quantity: 4 }],
});
row = await order(id);
assert.equal(row.total, 160000);
checks++;
const paidBody = {
  mode: "admin",
  operation: "status",
  orderId: id,
  version: row.version,
  status: "paid",
};
const paid = await Promise.all([
  fetch(base + "/api/b2b", {
    method: "POST",
    headers: {
      origin: base,
      "content-type": "application/json",
      cookie: admin,
    },
    body: JSON.stringify(paidBody),
  }),
  fetch(base + "/api/b2b", {
    method: "POST",
    headers: {
      origin: base,
      "content-type": "application/json",
      cookie: ionut,
    },
    body: JSON.stringify(paidBody),
  }),
]);
assert.deepEqual(paid.map((r) => r.status).sort(), [200, 409]);
checks++;
const credits = await db.query(
  "select amount from b2b_cashback where order_id=$1",
  [id],
);
assert.deepEqual(credits, [{ amount: 8000 }]);
checks++;
row = await order(id);
await api(
  admin,
  {
    mode: "admin",
    operation: "saveOrder",
    locationId: a,
    orderId: id,
    version: row.version,
    quantities: [{ productId: 1, quantity: 9 }],
  },
  409,
);
await api(
  admin,
  {
    mode: "admin",
    operation: "status",
    orderId: id,
    version: row.version,
    status: "confirmed",
  },
  409,
);
const introduced = (
  await api(ionut, {
    mode: "admin",
    operation: "saveOrder",
    locationId: b,
    requestKey: randomUUID(),
    quantities: [{ productId: 3, quantity: 1 }],
  })
).result.id;
let introducedRow = await order(introduced);
assert.equal(introducedRow.author, "Ionut");
checks++;
await api(localB, {
  mode: "portal",
  operation: "saveOrder",
  orderId: introduced,
  version: introducedRow.version,
  quantities: [{ productId: 3, quantity: 2 }],
});
const raceId = (
  await api(admin, {
    mode: "admin",
    operation: "saveOrder",
    locationId: b,
    requestKey: randomUUID(),
    quantities: [{ productId: 5, quantity: 1 }],
  })
).result.id;
const racePayloads = [
  {
    mode: "portal",
    operation: "saveOrder",
    orderId: raceId,
    version: 1,
    quantities: [{ productId: 5, quantity: 7 }],
  },
  {
    mode: "admin",
    operation: "status",
    orderId: raceId,
    version: 1,
    status: "confirmed",
  },
];
const race = await Promise.all(
  racePayloads.map((payload, i) =>
    fetch(base + "/api/b2b", {
      method: "POST",
      headers: {
        origin: base,
        "content-type": "application/json",
        cookie: i === 0 ? localB : admin,
      },
      body: JSON.stringify(payload),
    }),
  ),
);
assert.deepEqual(race.map((r) => r.status).sort(), [200, 409]);
const raceRow = await order(raceId);
const [raceTotal] = await db.query(
  "select sum(price*quantity)::integer as total from b2b_order_items where order_id=$1",
  [raceId],
);
assert.equal(raceRow.total, raceTotal.total);
checks++;
const htmlA = await (
  await fetch(base + "/comenzi", { headers: { cookie: localA } })
).text();
const htmlB = await (
  await fetch(base + "/comenzi", { headers: { cookie: localB } })
).text();
assert.ok(htmlA.includes("Local test actualizat"));
assert.ok(!htmlB.includes("Local test actualizat"));
assert.ok(!htmlA.includes("token_cipher"));
checks++;
const forbidden = await fetch(base + "/b2b", { headers: { cookie: localA } });
assert.ok(!(await forbidden.text()).includes("Link secret"));
checks++;
await api(
  admin,
  {
    mode: "admin",
    operation: "rotateLink",
    locationId: a,
    version: 1,
    confirmed: true,
    invalidateSessions: false,
  },
  400,
);
await api(admin, {
  mode: "admin",
  operation: "rotateLink",
  locationId: a,
  version: 1,
  confirmed: true,
  invalidateSessions: true,
});
const invalid = await fetch(oldLink, { redirect: "manual" });
assert.equal(invalid.status, 404);
assert.ok((await invalid.text()).includes("076922600"));
checks++;
await api(
  localA,
  {
    mode: "portal",
    operation: "saveOrder",
    requestKey: randomUUID(),
    quantities: [{ productId: 1, quantity: 1 }],
  },
  401,
);
await login(await link(a));
const [balance] = await db.query(
  "select sum(amount)::integer as balance from b2b_cashback where location_id=$1",
  [a],
);
assert.equal(balance.balance, 8000);
checks++;
console.log(
  `PASS: ${checks} B2B integration checks (permissions, isolation, edits, concurrency, cashback, rotation).`,
);
