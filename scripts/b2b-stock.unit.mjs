import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import ts from "typescript";
const require = createRequire(import.meta.url);
const compile = (file) =>
  ts.transpileModule(readFileSync(new URL(file, import.meta.url), "utf8"), {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
    },
  }).outputText;
const errors = {};
new Function("exports", "require", compile("../src/lib/b2b/errors.ts"))(errors, require);
const model = {};
new Function("exports", "require", compile("../src/lib/b2b/model.ts"))(
  model,
  require,
);
assert.equal(model.stockStatus("BRAIN FREEZE"), "available");
assert.equal(model.stockStatus("STWY"), "available");
assert.equal(
  model.products.filter(([n]) => model.stockStatus(n) === "available").length,
  25,
);
let mode = "portal",
  catalog = [],
  existing = [],
  calls = 0;
const route = {};
new Function("exports", "require", compile("../src/app/api/b2b/route.ts"))(
  route,
  (name) => {
    if (name === "next/server")
      return { NextResponse: { json: (v, init) => Response.json(v, init) } };
    if (name === "next/cache") return { revalidatePath() {} };
    if (name.endsWith("/b2b/model")) return model;
    if (name.endsWith("/b2b/errors")) return errors;
    if (name.endsWith("/b2b/crypto")) return {};
    if (name.endsWith("/b2b/telegram")) return { enqueueOrderNotification: async () => {} };
    if (name.endsWith("/b2b/server"))
      return {
        internalMember: async () => ({
          id: 1,
          name: "Patrick",
          slug: "patrick",
        }),
        currentLocation: async () => ({ id: 1, version: 1 }),
        query: async () => {
          calls++;
          return calls === 1
            ? catalog
            : calls === 2 && existing !== null
              ? existing
              : [{ id: 12 }];
        },
      };
    if (name.endsWith("/b2b/contact"))
      return require("../src/lib/b2b/contact.ts");
    if (name.endsWith("/b2b/access-statements"))
      return require("../src/lib/b2b/access-statements.ts");
    return require(name);
  },
);
async function check({
  name = "STWY",
  quantity = 1,
  old = null,
  status = 400,
  admin = false,
}) {
  calls = 0;
  catalog = [{ id: 4, name, flavor: "Test", grams: 200, price: 40000 }];
  existing = old === null ? null : [{ id: 4, quantity: old }];
  const response = await route.POST(
    new Request("http://localhost/api/b2b", {
      method: "POST",
      headers: {
        host: "localhost",
        origin: "http://localhost",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        mode: admin ? "admin" : "portal",
        operation: "saveOrder",
        locationId: 1,
        quantities: [{ productId: 4, quantity }],
        ...(old !== null
          ? { orderId: 12, version: 1 }
          : { requestKey: "d71e8c80-f5f1-4a8d-9ea0-e22a68dfdce0" }),
      }),
    }),
  );
  const responseBody = await response.json();
  assert.equal(
    response.status,
    status,
    `${name} ${quantity} old=${old} admin=${admin}: ${JSON.stringify(responseBody)}`,
  );
  if (status === 400) {
    const body = responseBody;
    assert.equal(body.errorCode, "stock");
    assert(body.error.startsWith("STWY are"));
    assert.equal(calls, old === null ? 1 : 2, "Rejected stock must not mutate");
  }
}
await check({ status: 200 });
await check({ admin: true, status: 200 });
model.stockOverrides.STWY = "unavailable";
await check({});
await check({ admin: true });
await check({ name: "BRAIN FREEZE", quantity: 2, status: 200 });
await check({ old: 2, quantity: 2, status: 200 });
await check({ old: 2, quantity: 1, status: 200 });
await check({ old: 2, quantity: 3 });
await check({ old: 0, quantity: 1 });
console.log(
  "PASS: all 25 products available; unavailable-stock safeguards verified with test overrides.",
);
