import assert from "node:assert/strict";
import { formatNewTaskMessages, deliverDigestMessages } from "../src/lib/telegram-task-digest.ts";

const member = (id, name) => ({ id, name });
const andrei = member(1, "Andrei"), igor = member(2, "Igor"), patrick = member(3, "Patrick");
const task = (id, assignees, title = `Vizita ${id}`) => ({ taskId: id, eventIds: [id], title, assignees, createdAt: new Date(id * 1000) });
assert.deepEqual(formatNewTaskMessages([]), []);
const one = formatNewTaskMessages([task(1, [igor], "Vizită 🥝 <local> & ceai")]);
assert.equal(one[0].text, "Sarcini primite de Igor\n- Vizită 🥝 <local> & ceai");
assert.equal(one[0].text.slice(0, one[0].entities[0].length), "Sarcini primite de Igor");
const grouped = formatNewTaskMessages([
  task(7, [patrick]), task(4, [igor, andrei, patrick]), task(2, [igor]),
  task(1, [andrei]), task(3, [igor]), task(5, [andrei, igor]), task(6, [igor, andrei]),
]);
assert.deepEqual(grouped.map((m) => m.text.split("\n")[0]), [
  "Sarcini primite de Andrei", "Sarcini primite împreună de Andrei și Igor",
  "Sarcini primite împreună de Andrei, Igor și Patrick", "Sarcini primite de Igor", "Sarcini primite de Patrick",
]);
assert.match(grouped[3].text, /Vizita 2\n- Vizita 3$/);
assert.equal(grouped.flatMap((m) => m.eventIds).length, 7);
const duplicate = formatNewTaskMessages([task(1, [igor]), { ...task(1, [igor]), eventIds: [99] }]);
assert.equal(duplicate[0].text.split("\n").length, 2);
assert.deepEqual(duplicate[0].eventIds, [1, 99]);
// The consumer supplies current assignments and excludes deleted tasks. An empty set is not sent.
assert.deepEqual(formatNewTaskMessages([task(1, [])]), []);
assert.match(formatNewTaskMessages([task(1, [patrick])])[0].text, /^Sarcini primite de Patrick/);
const many = Array.from({ length: 180 }, (_, i) => task(i + 1, [igor], `${i + 1} ${"Ș😀".repeat(40)}`));
const chunks = formatNewTaskMessages(many);
assert(chunks.length > 1);
assert.deepEqual(chunks.flatMap((m) => m.eventIds), many.map((t) => t.taskId));
for (const chunk of chunks) {
  assert(chunk.text.length <= 4096);
  assert(chunk.text.startsWith("Sarcini primite de Igor\n- "));
  assert.deepEqual(chunk.entities, [{ type: "bold", offset: 0, length: "Sarcini primite de Igor".length }]);
}
const ack = [], sent = [];
await assert.rejects(deliverDigestMessages(chunks, {
  isCurrent: async () => true,
  send: async (message) => { if (sent.length === 1) throw new Error("offline"); sent.push(message); },
  acknowledge: async (ids) => ack.push(...ids),
}), /offline/);
assert.deepEqual(ack, chunks[0].eventIds);
const remaining = formatNewTaskMessages(many.filter((entry) => !ack.includes(entry.taskId)));
await deliverDigestMessages(remaining, {
  isCurrent: async () => true,
  send: async (message) => sent.push(message),
  acknowledge: async (ids) => ack.push(...ids),
});
assert.deepEqual(ack, many.map((t) => t.taskId));
assert.equal(new Set(ack).size, many.length);
assert.equal(await deliverDigestMessages(one, {
  isCurrent: async () => false,
  send: async () => assert.fail("Stale generation must not send"),
  acknowledge: async () => assert.fail("Stale generation must not acknowledge"),
}), false);
console.log("Task digest: single, exact groups, ordering, Unicode, splitting, retry and stale generation passed.");
