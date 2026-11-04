// Test-only preload. Every Neon request is wrapped in a transaction whose search
// path contains only the disposable test schema, never public application data.
import { appendFileSync } from "node:fs";
const schema = process.env.TASK_DB_TEST_SCHEMA;
if (!/^kaja_task_ui_test_[a-f0-9]+$/.test(schema ?? "")) throw new Error("An isolated task test schema is required");
const originalFetch = globalThis.fetch;
globalThis.fetch = async (input, init) => {
  const url = String(input instanceof Request ? input.url : input);
  if (!url.includes("/sql") || !init?.body) return originalFetch(input, init);
  const request = JSON.parse(String(init.body));
  if (!request.query && !request.queries) return originalFetch(input, init);
  const single = !request.queries;
  const queries = request.queries ?? [{ query: request.query, params: request.params }];
  const start = performance.now();
  const response = await originalFetch(input, { ...init, body: JSON.stringify({ queries: [
    { query: `set local search_path to ${schema}`, params: [] }, ...queries,
  ] }) });
  const data = await response.json();
  if (process.env.TASK_DB_TEST_LOG) appendFileSync(process.env.TASK_DB_TEST_LOG, JSON.stringify({
    queries: queries.map(query => query.query), duration: Math.round(performance.now() - start), ok: response.ok,
  }) + "\n");
  const results = data.results?.slice(1);
  const payload = results ? single ? results[0] : { ...data, results } : data;
  const headers = new Headers(response.headers);
  headers.delete("content-length"); headers.delete("content-encoding");
  return new Response(JSON.stringify(payload), { status: response.status, headers });
};
