import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import ts from "typescript";
const require = createRequire(import.meta.url);
function load(file) {
  const output = ts.transpileModule(
    readFileSync(new URL(file, import.meta.url), "utf8"),
    {
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        target: ts.ScriptTarget.ES2022,
      },
    },
  ).outputText;
  const exports = {};
  new Function("exports", "require", output)(exports, require);
  return exports;
}
const model = load("../src/lib/b2b/model.ts");
const crypto = load("../src/lib/b2b/crypto.ts");
assert.equal(model.products.length, 25);
assert.equal(new Set(model.products.map((p) => p[0])).size, 25);
assert.deepEqual(
  model.products.map((p) => p[0]),
  [
    "BRAIN FREEZE",
    "C-TRICK",
    "CHA VERDE",
    "STWY",
    "HER PLEASURE",
    "GUAVERA",
    "LTP",
    "ALURE",
    "2LATE",
    "BEE ELIXIR",
    "FUDGE IT",
    "LOVE ANDA",
    "1st SIN",
    "POMPEI",
    "GREEN & HAIRY",
    "JAMPRICOT",
    "MONDAY MORNING",
    "SPOOKY",
    "PEARADISE",
    "MANSSI",
    "CIN&MON",
    "MON BLANC",
    "FOREST MASTER",
    "CHCK",
    "NILLA",
  ],
);
assert.equal(model.canManageOrders("patrick"), true);
assert.equal(model.canManageOrders("ionut"), true);
assert.equal(model.canManageOrders("igor"), false);
assert.equal(model.canManageOrders("andrei"), false);
for (const manager of [true, false])
  assert.equal(model.canEditOrder("paid", manager), false);
assert.equal(model.canEditOrder("confirmed", false), false);
assert.equal(model.canEditOrder("confirmed", true), true);
assert.equal(model.canEditOrder("placed", false), true);
assert.equal(model.nextStatus("placed"), "confirmed");
assert.equal(model.nextStatus("confirmed"), "paid");
assert.equal(model.nextStatus("paid"), null);
process.env.B2B_LINK_ENCRYPTION_KEY = "a".repeat(64);
const token = crypto.newToken();
assert.equal(token.length, 43);
assert.notEqual(token, crypto.newToken());
assert.equal(crypto.decryptToken(crypto.encryptToken(token)), token);
assert.notEqual(crypto.encryptToken(token), crypto.encryptToken(token));
const session = crypto.sessionValue(7, 2);
assert.deepEqual(crypto.parseSession(session), { id: 7, version: 2 });
assert.equal(crypto.parseSession(session.replace("7.2.", "7.3.")), null);
assert.equal(crypto.parseSession("invalid"), null);
process.env.B2B_LINK_ENCRYPTION_KEY = "b".repeat(64);
assert.equal(crypto.parseSession(session), null);
delete process.env.B2B_LINK_ENCRYPTION_KEY;
assert.throws(() => crypto.encryptToken(token));
console.log(
  "PASS: B2B catalogue, permission rules, status transitions, token encryption and session integrity.",
);
