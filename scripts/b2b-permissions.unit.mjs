import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import ts from "typescript";
const require = createRequire(import.meta.url);
const source = readFileSync(
  new URL("../src/app/api/b2b/route.ts", import.meta.url),
  "utf8",
);
const code = ts.transpileModule(source, {
  compilerOptions: {
    module: ts.ModuleKind.CommonJS,
    target: ts.ScriptTarget.ES2022,
  },
}).outputText;
let member,
  queries = 0;
const exports = {};
const real = (name) => require(name);
new Function("exports", "require", code)(exports, (name) => {
  if (name.endsWith("/b2b/telegram")) return {enqueueOrderNotification: async () => {}};
  if (name === "next/server")
    return {
      NextResponse: { json: (data, init) => Response.json(data, init) },
    };
  if (name === "next/cache") return { revalidatePath: () => {} };
  if (name.endsWith("/b2b/server"))
    return {
      internalMember: async () => member,
      currentLocation: async () => null,
      query: async () => {
        queries++;
        return [{ id: 1 }];
      },
      SUPPORT: "Support",
    };
  if (name.endsWith("/b2b/model"))
    return { canManageOrders: (slug) => ["patrick", "ionut"].includes(slug) };
  if (name.endsWith("/b2b/crypto"))
    return {
      newToken: () => "test-token",
      tokenHash: () => "test-hash",
      encryptToken: () => "test-cipher",
    };
  if (name.endsWith("/b2b/contact"))
    return require("../src/lib/b2b/contact.ts");
  if (name.endsWith("/b2b/access-statements"))
    return require("../src/lib/b2b/access-statements.ts");
  return real(name);
});
const fields = {
  name: "Test",
  address: "Test address",
  contact: "Test contact",
  phone: "076000000",
};
for (const slug of ["patrick", "ionut", "andrei", "igor"]) {
  member = { id: 1, slug };
  for (const operation of ["createLocation", "editLocation"]) {
    queries = 0;
    const response = await exports.POST(
      new Request("http://localhost/api/b2b", {
        method: "POST",
        headers: {
          host: "localhost",
          origin: "http://localhost",
          "content-type": "application/json",
        },
        body: JSON.stringify({
          mode: "admin",
          operation,
          ...fields,
          locationId: 1,
          version: 1,
        }),
      }),
    );
    const allowed =
      operation === "createLocation" || ["patrick", "ionut"].includes(slug);
    assert.equal(response.status, allowed ? 200 : 403, `${slug}: ${operation}`);
    assert.equal(
      queries,
      allowed ? 1 : 0,
      `${slug}: blocked requests must not query database`,
    );
  }
}
console.log("B2B location permissions: 8 role/operation scenarios passed.");
