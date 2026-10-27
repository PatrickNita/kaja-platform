// Runs real route/server code against a temporary, isolated PostgreSQL schema.
// Never inserts test locations, orders or members into public tables.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { resolve, dirname } from "node:path";
import { randomBytes, randomUUID } from "node:crypto";
import ts from "typescript";
import { neon } from "@neondatabase/serverless";
import { PgDialect } from "drizzle-orm/pg-core";
import { migrateAccessGroups } from "./migrate-b2b-access.mjs";
import { verifyInventory } from "./b2b-inventory-scenarios.mjs";
import { contactKey } from "../src/lib/b2b/contact.ts";
process.env.B2B_LINK_ENCRYPTION_KEY = randomBytes(32).toString("hex");
const require = createRequire(import.meta.url);
assert(process.env.DATABASE_URL, "DATABASE_URL required");
const schemaName = "kaja_b2b_test_" + randomBytes(6).toString("hex");
const root = neon(process.env.DATABASE_URL);
const testUrl = new URL(process.env.DATABASE_URL);
testUrl.searchParams.set("options", "-c search_path=" + schemaName);
const setPath = () => root.query("set local search_path to " + schemaName);
const db = {
  query(q, params = []) {
    return {
      q,
      params,
      then(ok, fail) {
        return root
          .transaction([setPath(), root.query(q, params)])
          .then((r) => r[1])
          .then(ok, fail);
      },
    };
  },
  transaction(statements) {
    return root
      .transaction([
        setPath(),
        ...statements.map((s) => root.query(s.q, s.params)),
      ])
      .then((r) => r.slice(1));
  },
};
const dialect = new PgDialect();
let member = { slug: "patrick", name: "Patrick" },
  cookie = "";
const cache = new Map();
const notificationQueue = [];
function load(path) {
  path = resolve(path);
  if (cache.has(path)) return cache.get(path);
  const result = {};
  cache.set(path, result);
  const code = ts.transpileModule(readFileSync(path, "utf8"), {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
    },
  }).outputText;
  new Function("exports", "require", code)(result, (name) => {
    if (name === "../../../lib/b2b/telegram")
      return {
        enqueueOrderNotification: async (eventId) => {
          notificationQueue.push(eventId);
        },
      };
    if (name === "server-only") return {};
    if (name === "next/cache") return { revalidatePath() {} };
    if (name === "next/headers")
      return {
        cookies: async () => ({
          get: () => (cookie ? { value: cookie } : undefined),
        }),
      };
    if (name.endsWith("/auth"))
      return { currentMember: async () => member };
    if (name === "../db" || name === "./db")
      return {
        db: {
          execute: async (statement) => {
            const q = dialect.sqlToQuery(statement);
            try {
              return { rows: await db.query(q.sql, q.params) };
            } catch (error) {
              console.error("Test database:", error.message);
              throw error;
            }
          },
        },
      };
    if (name.startsWith(".")) return load(resolve(dirname(path), name + ".ts"));
    return require(name);
  });
  return result;
}
const base = "http://localhost:3000";
let checks = 0;
async function api(payload, status = 200) {
  const response = await route.POST(
    new Request(base + "/api/b2b", {
      method: "POST",
      headers: {
        host: "localhost:3000",
        origin: base,
        "content-type": "application/json",
      },
      body: JSON.stringify(payload),
    }),
  );
  const value = await response.json();
  assert.equal(response.status, status, JSON.stringify(value));
  checks++;
  return value;
}
const fields = (name, contact = "Andrei", phone = "068694838") => ({
  name,
  address: "Str. Test 1",
  contact,
  phone,
});
let route, server, crypto, accessRoute;
async function entry(groupId, token, status = 307) {
  const res = await accessRoute.GET(
    new Request(base + "/comenzi/acces/" + groupId + "/" + token),
    { params: Promise.resolve({ id: String(groupId), token }) },
  );
  assert.equal(res.status, status);
  checks++;
  if (status === 307) cookie = res.cookies.get("kaja_b2b").value;
  return res;
}
try {
  await root.query("create schema " + schemaName);
  assert.equal(
    (await db.query("select current_schema() as name"))[0].name,
    schemaName,
  );
  await db.query(
    "create table members(id serial primary key,slug varchar(32) not null unique,name varchar(64) not null)",
  );
  const baseline = readFileSync(
    new URL("../drizzle/0014_b2b.sql", import.meta.url),
    "utf8",
  );
  await db.transaction(
    baseline.split("--> statement-breakpoint").map((q) => db.query(q)),
  );
  await db.query(
    "insert into members(slug,name) values('patrick','Patrick'),('ionut','Ionut'),('igor','Igor'),('andrei','Andrei')",
  );
  await db.query("create table product_feedback(id serial primary key)");
  for (const statement of readFileSync("drizzle/0021_member_seen.sql", "utf8").split("--> statement-breakpoint")) await db.query(statement);
  crypto = load("src/lib/b2b/crypto.ts");
  const old = [];
  for (const [i, c, p] of [
    [1, "Andrei", "068694838"],
    [2, " ANDREI ", "+373 68 694 838"],
    [3, "Andrei", "0037368694838"],
    [4, "Maria", "069123456"],
  ]) {
    const token = crypto.newToken();
    old.push(token);
    await db.query(
      "insert into b2b_locations(name,address,contact,phone,token_hash,token_cipher,created_by,updated_by) values($1,$2,$3,$4,$5,$6,1,1)",
      [
        "Local " + i,
        "Str. Test " + i,
        c,
        p,
        crypto.tokenHash(token),
        crypto.encryptToken(token),
      ],
    );
  }
  const migration = await migrateAccessGroups(db);
  assert.equal(migration.groups, 2);
  assert.equal(migration.sharedGroups, 1);
  assert.equal((await migrateAccessGroups(db)).alreadyApplied, true);
  await db.query(
    readFileSync(
      new URL("../drizzle/0016_b2b_company.sql", import.meta.url),
      "utf8",
    ),
  );
  await db.transaction(
    readFileSync(
      new URL("../drizzle/0017_b2b_notifications.sql", import.meta.url),
      "utf8",
    )
      .split("--> statement-breakpoint")
      .map((q) => db.query(q)),
  );
  const stockMigration = readFileSync("drizzle/0022_b2b_stock.sql","utf8").split("--> statement-breakpoint");
  await db.transaction(stockMigration.map(q => db.query(q)));
  assert.equal((await db.query("select count(*)::int as n from b2b_products where stock=100"))[0].n,25);
  await db.query("update b2b_products set stock=100000");
  server = load("src/lib/b2b/server.ts");
  server.internalMember = async () => {
    const [m] = await db.query("select * from members where slug=$1", [
      member.slug,
    ]);
    return m;
  };
  route = load("src/app/api/b2b/route.ts");
  accessRoute = load("src/app/comenzi/acces/[id]/[token]/route.ts");
  if(process.env.B2B_TEST_LOCATION_ONLY === "1") {
    await (await import("./b2b-order-location.scenarios.mjs")).verifyOrderLocation({db,api,route,base,crypto,setCookie:value=>{cookie=value;},setMember:value=>{member=value;}});
  } else {
  let [group] = await db.query("select * from b2b_access_groups where id=1");
  for (let i = 1; i <= 3; i++) await entry(i, old[i - 1], 404);
  cookie = crypto.sessionValue(1, 1);
  assert.equal(await server.currentAccess(), null);
  await entry(4, old[3]);
  assert.equal((await server.currentLocation()).id, 4);
  const sharedToken = crypto.decryptToken(group.token_cipher);
  await entry(1, sharedToken);
  for (const ua of ["TelegramBot (like TwitterBot)", "WhatsApp/2.0"]) {
    const response = await accessRoute.GET(
      new Request(
        base + "/comenzi/acces/1/" + sharedToken + "?preview=2-test",
        {
          headers: { "user-agent": ua },
        },
      ),
      { params: Promise.resolve({ id: "1", token: sharedToken }) },
    );
    assert.equal(response.status, 200);
    assert(response.headers.get("content-type").includes("text/html"));
    assert.equal(response.headers.get("set-cookie"), null);
    assert.equal(response.headers.get("vary"), "User-Agent");
    const html = await response.text();
    assert(html.includes("KAJA - Local 1, Local 2, Local 3"));
    assert(html.includes("Link pentru comenzi"));
    assert(!html.includes(sharedToken));
    assert(!html.includes("068694838"));
    checks++;
  }
  const singlePreview = await accessRoute.GET(
    new Request(base + "/comenzi/acces/4/" + old[3], {
      headers: { "user-agent": "TelegramBot" },
    }),
    { params: Promise.resolve({ id: "4", token: old[3] }) },
  );
  assert((await singlePreview.text()).includes("KAJA - Local 4"));
  checks++;
  const invalidPreview = await accessRoute.GET(
    new Request(base + "/comenzi/acces/1/" + old[0], {
      headers: { "user-agent": "TelegramBot" },
    }),
    { params: Promise.resolve({ id: "1", token: old[0] }) },
  );
  assert.equal(invalidPreview.status, 404);
  checks++;

  let data = await server.loadData(await server.currentLocation());
  assert.equal(data.locations.length, 3);
  assert(!data.locations.some((l) => l.link));
  assert.equal(await server.currentLocation(4), null);
  await api(
    {
      mode: "portal",
      operation: "saveOrder",
      locationId: 4,
      requestKey: randomUUID(),
      quantities: [{ productId: 1, quantity: 1 }],
    },
    401,
  );
  for (const locationId of [1, 2, 3])
    await api({
      mode: "portal",
      operation: "saveOrder",
      locationId,
      requestKey: randomUUID(),
      quantities: [{ productId: 1, quantity: locationId }],
    });
  data = await server.loadData(await server.currentLocation());
  assert.deepEqual(data.orders.map((o) => o.location_id).sort(), [1, 2, 3]);
  let [order] = await db.query("select * from b2b_orders where location_id=2");
  await api({
    mode: "admin",
    operation: "status",
    orderId: order.id,
    version: 1,
    status: "confirmed",
  });
  await api({
    mode: "admin",
    operation: "status",
    orderId: order.id,
    version: 2,
    status: "paid",
  });
  await api(
    {
      mode: "admin",
      operation: "status",
      orderId: order.id,
      version: 2,
      status: "paid",
    },
    409,
  );
  assert.equal(
    (await db.query("select amount from b2b_cashback where location_id=2"))[0]
      .amount,
    4000,
  );
  // Editing and confirmation with the same version cannot overwrite one another.
  const [racing] = await db.query(
    "select * from b2b_orders where location_id=1",
  );
  const racePayloads = [
    {
      mode: "admin",
      operation: "saveOrder",
      locationId: 1,
      orderId: racing.id,
      version: racing.version,
      quantities: [{ productId: 1, quantity: 2 }],
    },
    {
      mode: "admin",
      operation: "status",
      orderId: racing.id,
      version: racing.version,
      status: "confirmed",
    },
  ];
  const raceResults = await Promise.all(
    racePayloads.map((body) =>
      route.POST(
        new Request(base + "/api/b2b", {
          method: "POST",
          headers: {
            host: "localhost:3000",
            origin: base,
            "content-type": "application/json",
          },
          body: JSON.stringify(body),
        }),
      ),
    ),
  );
  assert.deepEqual(raceResults.map((r) => r.status).sort(), [200, 409]);
  checks += 2;
  const [afterRace] = await db.query("select * from b2b_orders where id=$1", [
    racing.id,
  ]);
  assert.equal(
    new Date(afterRace.created_at).getTime(),
    new Date(racing.created_at).getTime(),
  );
  const [editableConfirmed] = await db.query(
    "select * from b2b_orders where location_id=3",
  );
  await api({
    mode: "admin",
    operation: "status",
    orderId: editableConfirmed.id,
    version: 1,
    status: "confirmed",
  });
  await api({
    mode: "admin",
    operation: "saveOrder",
    locationId: 3,
    orderId: editableConfirmed.id,
    version: 2,
    quantities: [{ productId: 1, quantity: 4 }],
  });
  await api(
    {
      mode: "admin",
      operation: "saveOrder",
      locationId: 2,
      orderId: order.id,
      version: 3,
      quantities: [{ productId: 1, quantity: 4 }],
    },
    409,
  );
  const concurrent = await Promise.all([
    api({
      mode: "admin",
      operation: "createLocation",
      ...fields("Nou A", "Mihai", "069000001"),
    }),
    api({
      mode: "admin",
      operation: "createLocation",
      ...fields("Nou B", "MIHAI", "+37369000001"),
    }),
  ]);
  const ids = concurrent.map((x) => x.result.id);
  const created = await db.query(
    "select access_group_id from b2b_locations where id=any($1::int[])",
    [ids],
  );
  assert.equal(created[0].access_group_id, created[1].access_group_id);
  await api({
    mode: "admin",
    operation: "createLocation",
    ...fields("Local 5"),
  });
  const [fifth] = await db.query(
    "select * from b2b_locations where name='Local 5'",
  );
  assert.equal(fifth.access_group_id, 1);
  const adminData = await server.loadData();
  assert(
    adminData.locations.every((l) => /\?preview=2-[a-f0-9]{12}$/.test(l.link)),
  );
  assert.equal(
    new Set(
      adminData.locations
        .filter((l) => l.access_group_id === 1)
        .map((l) => l.link),
    ).size,
    1,
  );
  await api(
    {
      mode: "admin",
      operation: "editLocation",
      locationId: 2,
      version: 1,
      ...fields("Local 2", "Maria", "069123456"),
    },
    409,
  );
  await api({
    mode: "admin",
    operation: "editLocation",
    locationId: 2,
    version: 1,
    confirmContactChange: true,
    ...fields("Local 2", "Maria", "069123456"),
  });
  assert.equal(await server.currentLocation(2), null);
  data = await server.loadData(await server.currentLocation());
  assert(!data.orders.some((o) => o.location_id === 2));
  assert.equal(
    data.locations.reduce((n, l) => n + l.cashback, 0),
    0,
  );
  await api(
    {
      mode: "portal",
      operation: "saveOrder",
      locationId: 2,
      orderId: order.id,
      version: 3,
      quantities: [{ productId: 1, quantity: 3 }],
    },
    401,
  );
  await entry(4, old[3]);
  data = await server.loadData(await server.currentLocation());
  assert.equal(data.locations.length, 2);
  assert.equal(
    data.locations.reduce((n, l) => n + l.cashback, 0),
    4000,
  );
  assert(data.orders.some((o) => o.id === order.id));
  for (const role of ["igor", "andrei"]) {
    member = { slug: role, name: role };
    await api(
      {
        mode: "admin",
        operation: "editLocation",
        locationId: 1,
        version: 1,
        ...fields("Forbidden"),
      },
      403,
    );
    await api(
      {
        mode: "admin",
        operation: "rotateLink",
        locationId: 1,
        groupId: 1,
        version: 2,
        confirmed: true,
        invalidateSessions: true,
      },
      403,
    );
    await api(
      {
        mode: "admin",
        operation: "createLocation",
        ...fields("Created " + role),
      },
      200,
    );
  }
  member = { slug: "ionut", name: "Ionut" };
  await entry(1, sharedToken);
  await api(
    {
      mode: "admin",
      operation: "rotateLink",
      locationId: 1,
      groupId: 1,
      version: 2,
      confirmed: true,
    },
    400,
  );
  await api({
    mode: "admin",
    operation: "rotateLink",
    locationId: 1,
    groupId: 1,
    version: 2,
    confirmed: true,
    invalidateSessions: true,
  });
  assert.equal(await server.currentAccess(), null);
  await entry(1, sharedToken, 404);
  [group] = await db.query("select * from b2b_access_groups where id=1");
  await entry(1, crypto.decryptToken(group.token_cipher));
  await api({
    mode: "portal",
    operation: "saveOrder",
    locationId: 1,
    requestKey: randomUUID(),
    quantities: [{ productId: 1, quantity: 1 }],
  });
  // A request that authenticated before a transfer must still fail at mutation time.
  const originalCurrentLocation = server.currentLocation;
  server.currentLocation = async (id) => {
    const result = await originalCurrentLocation(id);
    if (result && id === 1) {
      await api({
        mode: "admin",
        operation: "editLocation",
        locationId: 1,
        version: 1,
        confirmContactChange: true,
        ...fields("Local 1", "Maria", "069123456"),
      });
    }
    return result;
  };
  await api(
    {
      mode: "portal",
      operation: "saveOrder",
      locationId: 1,
      requestKey: randomUUID(),
      quantities: [{ productId: 1, quantity: 1 }],
    },
    409,
  );
  server.currentLocation = originalCurrentLocation;
  // Rotation between authentication and mutation also rejects the stale session.
  server.currentLocation = async (id) => {
    const result = await originalCurrentLocation(id);
    if (result) {
      await api({
        mode: "admin",
        operation: "rotateLink",
        locationId: 3,
        groupId: 1,
        version: group.version,
        confirmed: true,
        invalidateSessions: true,
      });
    }
    return result;
  };
  await api(
    {
      mode: "portal",
      operation: "saveOrder",
      locationId: 3,
      requestKey: randomUUID(),
      quantities: [{ productId: 1, quantity: 1 }],
    },
    409,
  );
  server.currentLocation = originalCurrentLocation;
  assert.equal(
    contactKey("  Andréi  Popescu ", "+373 68 694 838"),
    contactKey("andrei popescu", "068694838"),
  );
  // Corporate data is optional, never accepted at creation, and visible only to managers.
  member = { slug: "patrick", name: "Patrick" };
  await api(
    {
      mode: "admin",
      operation: "createLocation",
      ...fields("Not allowed"),
      companyName: "Hidden SRL",
      idno: "1234567890123",
    },
    403,
  );
  const [corporateLocation] = await db.query(
    "select * from b2b_locations where id=2",
  );
  await api({
    mode: "admin",
    operation: "editLocation",
    locationId: 2,
    version: corporateLocation.details_version,
    companyName: "Exemplu SRL",
    idno: "1234567890123",
    ...fields("Local 2", "Maria", "069123456"),
  });
  for (const slug of ["patrick", "ionut", "andrei", "igor"]) {
    member = { slug, name: slug };
    const visible = await server.loadData();
    const scoped = await server.loadData(undefined, 2);
    assert.deepEqual(scoped.locations.map(l => l.id), [2]);
    assert.deepEqual(scoped.orders, []); // Detail loading does not fetch order histories.
    assert.deepEqual(scoped.locations[0], visible.locations.find(l => l.id === 2));
    const venue = visible.locations.find((l) => l.id === 2);
    if (["patrick", "ionut"].includes(slug)) {
      assert.equal(venue.company_name, "Exemplu SRL");
      assert.equal(venue.idno, "1234567890123");
    } else {
      assert(!("company_name" in venue));
      assert(!("idno" in venue));
      await api(
        {
          mode: "admin",
          operation: "editLocation",
          locationId: 2,
          version: 999,
          companyName: "Forbidden",
          ...fields("Local 2"),
        },
        403,
      );
    }
  }
  await entry(4, old[3]);
  const portal = await server.loadData(await server.currentLocation());
  assert(
    portal.locations.every((l) => !("company_name" in l) && !("idno" in l)),
  );
  const venue = portal.locations.find((l) => l.id === 2);
  const [last] = await db.query(
    "select max(created_at) as date from b2b_orders where location_id=2",
  );
  assert.equal(
    new Date(venue.last_order_at).getTime(),
    new Date(last.date).getTime(),
  );
  const [paidOrder] = await db.query(
    "select * from b2b_orders where location_id=2",
  );
  await api(
    {
      mode: "portal",
      operation: "saveOrder",
      locationId: 2,
      orderId: paidOrder.id,
      version: paidOrder.version,
      quantities: [{ productId: 1, quantity: 1 }],
    },
    409,
  );
  member = { slug: "patrick", name: "Patrick" };
  const requestKey = randomUUID();
  const newOrder = {
    mode: "admin",
    operation: "saveOrder",
    locationId: 2,
    requestKey,
    quantities: [
      { productId: 1, quantity: 2 },
      { productId: 2, quantity: 1 },
    ],
  };
  const first = await api(newOrder);
  await api(newOrder);
  let events = await db.query(
    "select * from b2b_notifications where order_id=$1 order by id",
    [first.result.id],
  );
  assert.equal(events.length, 1, "Repeated create has one event");
  assert.equal(events[0].payload.kind, "created");
  assert.equal(events[0].payload.actor, "Patrick");
  assert.equal(events[0].payload.total, 120000);
  assert.deepEqual(Object.keys(events[0].payload.location).sort(), [
    "address",
    "idno",
    "name",
  ]);
  assert.equal(events[0].payload.location.idno, "1234567890123");
  await api({
    mode: "admin",
    operation: "saveOrder",
    locationId: 2,
    orderId: first.result.id,
    version: 1,
    quantities: newOrder.quantities,
  });
  assert.equal(
    (
      await db.query(
        "select count(*)::int as n from b2b_notifications where order_id=$1",
        [first.result.id],
      )
    )[0].n,
    1,
    "Unchanged save has no event",
  );
  await api({
    mode: "admin",
    operation: "saveOrder",
    locationId: 2,
    orderId: first.result.id,
    version: 2,
    quantities: [
      { productId: 1, quantity: 3 },
      { productId: 3, quantity: 1 },
    ],
  });
  events = await db.query(
    "select * from b2b_notifications where order_id=$1 order by id",
    [first.result.id],
  );
  assert.equal(events.length, 2);
  assert.equal(events[1].payload.kind, "edited");
  assert.equal(events[1].payload.location.idno, "1234567890123");
  assert.equal(events[1].payload.previous[0].quantity, 2);
  assert.deepEqual(
    events[1].payload.previous.map((l) => l.id),
    [1, 2],
  );
  assert.deepEqual(
    events[1].payload.lines.map((l) => l.id),
    [1, 3],
  );
  await api(
    {
      mode: "admin",
      operation: "saveOrder",
      locationId: 2,
      orderId: first.result.id,
      version: 2,
      quantities: [{ productId: 1, quantity: 7 }],
    },
    409,
  );
  await api({
    mode: "admin",
    operation: "status",
    orderId: first.result.id,
    version: 3,
    status: "confirmed",
  });
  assert.equal(
    (
      await db.query(
        "select count(*)::int as n from b2b_notifications where order_id=$1",
        [first.result.id],
      )
    )[0].n,
    2,
    "Conflict/status has no event",
  );
  assert.equal(new Set(notificationQueue).size, notificationQueue.length);
  const { deliverNotification, notificationMessages } = load(
    "src/lib/b2b/telegram-delivery.ts",
  );
  const sent = [];
  const fakeFetch = async (_url, init) => {
    sent.push(JSON.parse(init.body));
    return new Response(JSON.stringify({ ok: true }), { status: 200 });
  };
  await Promise.all(
    [
      deliverNotification(
        events[0].id,
        (q, p) => db.query(q, p),
        "test-token",
        "-100123",
        fakeFetch,
      ),
      deliverNotification(
        events[0].id,
        (q, p) => db.query(q, p),
        "test-token",
        "-100123",
        fakeFetch,
      ),
    ].map((p) =>
      p.catch((e) => {
        assert.match(e.message, /being processed/);
      }),
    ),
  );
  await deliverNotification(
    events[0].id,
    (q, p) => db.query(q, p),
    "test-token",
    "-100123",
    fakeFetch,
  );
  assert.equal(sent.length, 1, "Concurrent/repeated delivery sends once");
  assert.equal(sent[0].chat_id, "-100123");
  assert(sent[0].text.includes("1.200 MDL"));
  await assert.rejects(
    deliverNotification(
      events[1].id,
      (q, p) => db.query(q, p),
      "secret-token",
      "-100123",
      async () => {
        throw Error("sensitive URL");
      },
    ),
    /B2B Telegram delivery failed/,
  );
  assert.equal(
    (
      await db.query("select sent_at from b2b_notifications where id=$1", [
        events[1].id,
      ])
    )[0].sent_at,
    null,
  );
  await deliverNotification(
    events[1].id,
    (q, p) => db.query(q, p),
    "test-token",
    "-100123",
    fakeFetch,
  );
  assert.equal(sent.length, 2);
  assert(
    notificationMessages(events[1].payload).join("\n").includes("2 → 3 buc."),
  );
  console.log(
    "PASS: B2B notification snapshots, no-op/conflict/status suppression, request idempotency, concurrent delivery, Telegram failure and retry.",
  );
  member = {slug:"patrick",name:"Patrick"};
  await verifyInventory({db, api, load, setMember:value => {member=value;}, base, stockMigration});
  await (await import("./b2b-order-location.scenarios.mjs")).verifyOrderLocation({db,api,route,base,crypto,setCookie:value=>{cookie=value;},setMember:value=>{member=value;}});
  console.log(
    "PASS: " +
      checks +
      " real API scenarios; migration, singleton compatibility, shared links, sessions, isolation, concurrent grouping, per-location cashback and contact transfer.",
  );
  }
} finally {
  await root.query("drop schema if exists " + schemaName + " cascade");
}
