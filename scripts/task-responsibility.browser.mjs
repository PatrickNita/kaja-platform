import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { spawn } from "node:child_process";
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { pathToFileURL } from "node:url";
import { neon } from "@neondatabase/serverless";
import { PgDialect } from "drizzle-orm/pg-core";
import { taskAssignmentQueries, taskAssigneeSnapshotQuery } from "../src/lib/task-assignment-queries.ts";

const { chromium } = await import(pathToFileURL(process.env.PLAYWRIGHT_MODULE_PATH).href);
const db = neon(process.env.DATABASE_URL), dialect = new PgDialect();
const schema = "kaja_task_ui_test_" + randomBytes(6).toString("hex");
const base = "http://localhost:3014", log = "tmp/task-ui-db.jsonl";
mkdirSync("tmp", { recursive: true }); writeFileSync(log, "");
const q = (text, values = []) => db.transaction([
  db.query(`set local search_path to ${schema}`), db.query(text, values),
]).then(result => result[1]);
const queries = () => readFileSync(log, "utf8").trim().split("\n").filter(Boolean).map(line => JSON.parse(line));
const rows = () => q("select member_id,completed from task_assignees where task_id=100 order by member_id");
let server, browser, output = "";
try {
  await db.query(`create schema ${schema}`);
  for (const table of ["members", "tasks", "task_assignees", "comments", "comment_reactions", "activity"]) {
    await q(`create table ${table} (like public.${table} including all)`);
    await q(`create sequence ${table}_ui_id_seq start 1000`);
    await q(`alter table ${table} alter column id set default nextval('${schema}.${table}_ui_id_seq')`);
  }
  await q("insert into members(id,slug,name) values(1,'patrick','Patrick'),(2,'ionut','Ionut'),(3,'igor','Igor'),(4,'andrei','Andrei')");
  await q("insert into tasks(id,brand,title,body,created_by,updated_by) values(100,'kaja','Test responsabilitate','Descriere integrală 🥝 pentru verificare.',1,1),(101,'kaja','Test finalizare','Descriere finalizare.',1,1),(102,'kaja','Test concurență','Descriere concurență.',1,1)");
  await q("insert into task_assignees(task_id,member_id) values(100,3),(101,1),(102,1),(102,3)");

  // Same database and disposable fixtures: former five-request mutation versus
  // the new two-request mutation. Page rebuilding is measured separately below.
  const baseline = [], optimized = [];
  for (const old of [true, false]) for (let i = 0; i < 3; i++) {
    await q("delete from task_assignees where task_id=100 and member_id=1");
    const start = performance.now();
    if (old) {
      await q("insert into members(slug,name) values('patrick','Patrick') on conflict do nothing");
      await q("select id from members where slug='patrick'");
      await q("select id from tasks where id=100 and brand='kaja' and deleted_at is null");
      await q("select id from members where slug='patrick'");
    } else await q("select id,slug from members where slug in ('patrick')");
    const statements = taskAssignmentQueries(100, "kaja", 1, true);
    const batch = [...statements, ...(!old ? [taskAssigneeSnapshotQuery(100)] : [])].map(s => dialect.sqlToQuery(s));
    await db.transaction([db.query(`set local search_path to ${schema}`), ...batch.map(s => db.query(s.sql, s.params))]);
    (old ? baseline : optimized).push(Math.round(performance.now() - start));
  }
  await q("delete from task_assignees where task_id=100 and member_id=1");
  server = spawn(process.execPath, ["node_modules/next/dist/bin/next", "start", "-p", "3014"], {
    windowsHide: true, stdio: ["ignore", "pipe", "pipe"], env: {
      ...process.env,
      NODE_OPTIONS: `--import=${new URL("./task-db-isolation.mjs", import.meta.url).href}`,
      TASK_DB_TEST_SCHEMA: schema, TASK_DB_TEST_LOG: log,
      MEMBER_LINKS: "patrick:isolated-responsibility,igor:isolated-responsibility,andrei:isolated-responsibility,ionut:isolated-responsibility",
      SESSION_SECRET: "isolated-responsibility-browser-secret", TELEGRAM_BOT_TOKEN: "", TELEGRAM_CHAT_ID: "",
    },
  });
  server.stdout.on("data", chunk => output += chunk); server.stderr.on("data", chunk => output += chunk);
  for (let i = 0; i < 80 && !output.includes("Ready"); i++) await new Promise(resolve => setTimeout(resolve, 100));
  assert(output.includes("Ready"), output);
  browser = await chromium.launch({ channel: "chrome", headless: true });
  const context = await browser.newContext({ reducedMotion: "reduce" });
  await context.request.get(base + "/member/patrick/isolated-responsibility", { maxRedirects: 0 });
  let mode = "slow", posts = 0, captured;
  await context.route("**/*", async route => {
    const request = route.request();
    if (request.headers()["next-router-prefetch"]) return route.fulfill({ status: 204 });
    if (request.method() !== "POST") return route.continue();
    posts++; captured = { headers: request.headers(), body: request.postDataBuffer() };
    if (mode === "fail") { await new Promise(resolve => setTimeout(resolve, 1200)); return route.fulfill({ status: 500, body: "isolated test failure" }); }
    if (mode === "slow") await new Promise(resolve => setTimeout(resolve, 1200));
    return route.continue();
  });
  const page = await context.newPage(), errors = [], timings = [];
  page.on("pageerror", error => errors.push(error.message));
  async function open(id = 100, view = "all") {
    await page.goto(`${base}/?view=tasks&brand=kaja&tasks=${view}#entry-task-${id}`);
    await page.getByRole("dialog").waitFor();
    return page.getByRole("dialog");
  }
  async function settled() {
    await page.waitForFunction(() => document.querySelector('[role="dialog"] .task-assignee-manager')?.getAttribute("aria-busy") === "false");
  }
  let dialog = await open();
  assert.equal(queries().length, 1, "Task page must use one read-only database batch");
  assert.equal(queries()[0].queries.length, 6);
  const offset = queries().length;
  const postsBeforeAdd = posts;
  let start = performance.now();
  await dialog.getByRole("button", { name: "Adaugă responsabilul Patrick", exact: true }).evaluate(button => { button.click(); button.click(); });
  await dialog.getByRole("button", { name: "Elimină responsabilul Patrick", exact: true }).waitFor();
  timings.push(Math.round(performance.now() - start));
  assert(timings.at(-1) < 1000, "UI must update before the delayed request reaches the server");
  assert(await dialog.getByRole("button", { name: "Adaugă responsabilul Ionut", exact: true }).isDisabled());
  assert.equal((await rows()).length, 1, "Optimistic UI must not pretend the database has saved yet");
  await settled();
  assert.equal(posts - postsBeforeAdd, 1, "Repeated click must not create a second request");
  assert.equal((await rows()).length, 2);
  const saveQueries = queries().slice(offset);
  assert.equal(saveQueries.length, 3, JSON.stringify(saveQueries));
  assert.equal(saveQueries.reduce((n, request) => n + request.queries.length, 0), 10);

  mode = "fail"; start = performance.now();
  await dialog.getByRole("button", { name: "Adaugă responsabilul Ionut", exact: true }).click();
  await dialog.getByRole("button", { name: "Elimină responsabilul Ionut", exact: true }).waitFor();
  timings.push(Math.round(performance.now() - start));
  await dialog.getByRole("alert").waitFor(); await settled();
  assert.equal((await rows()).length, 2);
  assert.equal(await dialog.getByRole("button", { name: "Adaugă responsabilul Ionut", exact: true }).count(), 1);
  mode = "pass";
  await dialog.getByRole("button", { name: "Reîncearcă", exact: true }).click(); await settled();
  assert.equal((await rows()).length, 3);

  mode = "slow"; start = performance.now();
  await dialog.getByRole("button", { name: "Elimină responsabilul Ionut", exact: true }).click();
  await dialog.getByRole("button", { name: "Adaugă responsabilul Ionut", exact: true }).waitFor();
  timings.push(Math.round(performance.now() - start));
  await settled(); assert.equal((await rows()).length, 2);
  const removeCapture = captured;
  start = performance.now();
  await dialog.getByRole("button", { name: "Marchează finalizat pentru Igor", exact: true }).click();
  await dialog.getByRole("button", { name: "Marchează nefinalizat pentru Igor", exact: true }).waitFor();
  timings.push(Math.round(performance.now() - start));
  await settled(); assert((await rows()).find(m => m.member_id === 3).completed);

  // A response must not discard a dirty description when its task changes group.
  mode = "pass";
  await dialog.getByRole("button", { name: "Modifică", exact: true }).click();
  await dialog.getByRole("textbox", { name: "Descriere", exact: true }).fill("Ciornă nesalvată 🥝");
  await dialog.getByRole("button", { name: "Adaugă responsabilul Andrei", exact: true }).click();
  await settled();
  assert.equal(await dialog.getByRole("textbox", { name: "Descriere", exact: true }).inputValue(), "Ciornă nesalvată 🥝");
  page.on("dialog", confirmation => confirmation.accept());
  await dialog.getByRole("button", { name: "Anulează", exact: true }).click();
  await page.keyboard.press("Escape");

  dialog = await open(101);
  await dialog.getByRole("button", { name: "Modifică", exact: true }).click();
  await dialog.getByRole("textbox", { name: "Descriere", exact: true }).fill("Ciornă păstrată înainte de finalizare");
  const postsBeforeDraft = posts;
  await dialog.getByRole("button", { name: "Marchează finalizat pentru Patrick", exact: true }).click();
  await dialog.getByRole("alert").waitFor();
  assert.equal(posts, postsBeforeDraft);
  assert.equal(await dialog.getByRole("textbox", { name: "Descriere", exact: true }).inputValue(), "Ciornă păstrată înainte de finalizare");
  await dialog.getByRole("button", { name: "Anulează", exact: true }).click();
  mode = "slow";
  await dialog.getByRole("button", { name: "Marchează finalizat pentru Patrick", exact: true }).click();
  assert.equal(await page.locator("#entry-task-101").count(), 1, "History move must wait for server confirmation");
  await page.locator("#entry-task-101").waitFor({ state: "detached" });
  await page.goto(base + "/?view=tasks&brand=all&tasks=history");
  assert.equal(await page.locator("#entry-task-101").count(), 1);

  // Replay an action in a different member's session: server authorization wins.
  await q("insert into task_assignees(task_id,member_id) values(100,2) on conflict do nothing");
  const other = await browser.newContext();
  await other.request.get(base + "/member/igor/isolated-responsibility", { maxRedirects: 0 });
  const headers = { ...removeCapture.headers }; delete headers.cookie; delete headers["content-length"]; delete headers.host;
  const denied = await other.request.post(base + "/?view=tasks&brand=kaja&tasks=all", { headers, data: removeCapture.body });
  assert((await denied.text()).includes("Doar Patrick"));
  assert((await rows()).some(a => a.member_id === 2)); await other.close();

  // Two sessions remove different assignees simultaneously; both dialogs survive.
  dialog = await open(102);
  const concurrent = await browser.newContext();
  await concurrent.request.get(base + "/member/patrick/isolated-responsibility", { maxRedirects: 0 });
  await concurrent.route("**/*", async route => {
    if (route.request().headers()["next-router-prefetch"]) return route.fulfill({ status: 204 });
    if (route.request().method() === "POST") await new Promise(resolve => setTimeout(resolve, 1200));
    return route.continue();
  });
  const second = await concurrent.newPage();
  await second.goto(base + "/?view=tasks&brand=kaja&tasks=all#entry-task-102");
  await second.getByRole("dialog").waitFor();
  await Promise.all([
    dialog.getByRole("button", { name: "Elimină responsabilul Igor", exact: true }).click(),
    second.getByRole("dialog").getByRole("button", { name: "Elimină responsabilul Patrick", exact: true }).click(),
  ]);
  await settled();
  await second.waitForFunction(() => document.querySelector('[role="dialog"] .task-assignee-manager')?.getAttribute("aria-busy") === "false");
  assert.equal((await q("select * from task_assignees where task_id=102")).length, 1);
  assert.equal(await dialog.count(), 1); assert.equal(await second.getByRole("dialog").count(), 1);
  assert.equal(await dialog.locator(".task-member-remove").count(), 1);
  assert.equal(await second.getByRole("dialog").locator(".task-member-remove").count(), 1);
  assert(await dialog.locator(".task-member-remove").isDisabled());
  assert.equal(await dialog.getByRole("alert").count() + await second.getByRole("dialog").getByRole("alert").count(), 1);
  await concurrent.close();
  assert(queries().every(request => request.queries.every(query => !/workspace_items|b2b_|attachments|insert into "members"/i.test(query))));
  assert.deepEqual(errors, []);
  const report = { baselineMutationMs: baseline, optimizedMutationMs: optimized,
    beforeMutationRequests: 5, afterMutationRequests: 2, saveAndReloadRequests: saveQueries.length,
    saveAndReloadSql: 10, optimisticReactionMs: timings, posts,
    failureRollback: true, retry: true, historyAfterConfirmation: true, draftPreserved: true, serverPermission: true,
    repeatedClickBlocked: true, simultaneousRemovalProtected: true, refusedSaveKeptDialog: true };
  writeFileSync("tmp/task-responsibility-performance.json", JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report));
} catch (error) { console.error(output.slice(-5000)); throw error; }
finally {
  await browser?.close();
  if (server && server.exitCode === null && server.signalCode === null) {
    server.kill();
    await new Promise(resolve => server.once("exit", resolve));
  }
  assert.match(schema, /^kaja_task_ui_test_[a-f0-9]+$/);
  await db.query(`drop schema if exists ${schema} cascade`);
}
