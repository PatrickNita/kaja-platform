import assert from "node:assert/strict";
import { groupTaskList, taskDescriptionPreview } from "../src/lib/task-list.ts";

const row = (id, createdAt = id) => ({ task: { id, createdAt: new Date(createdAt * 1000) } });
const assigned = (taskId, memberId, memberName, completed = false) => ({
  assignment: { taskId, memberId, completed }, memberName, memberSlug: memberName.toLowerCase(),
});
const rows = [row(5), row(4), row(3), row(2), row(1)];
const assignments = [assigned(1, 2, "Igor"), assigned(2, 1, "Andrei"), assigned(3, 2, "Igor"),
  assigned(3, 1, "Andrei", true), assigned(4, 1, "Andrei"), assigned(4, 2, "Igor"), assigned(5, 3, "Patrick")];
const groups = groupTaskList(rows, assignments);
assert.deepEqual(groups.map(({ title }) => title), [
  "Sarcini primite de Andrei", "Sarcini primite împreună de Andrei și Igor",
  "Sarcini primite de Igor", "Sarcini primite de Patrick",
]);
assert.deepEqual(groups[1].entries.map(({ row }) => row.task.id), [3, 4]);
assert.deepEqual(groups[1].entries[0].assignments.map(({ memberName }) => memberName), ["Andrei", "Igor"]);
assert.equal(new Set(groups.flatMap(({ entries }) => entries.map(({ row }) => row.task.id))).size, rows.length);
assert.deepEqual(groupTaskList([], assignments), []);
assert.equal(groupTaskList([row(9)], [])[0].title, "Sarcini fără responsabili");
assert.equal(taskDescriptionPreview("Scurt 😀"), "Scurt 😀");
assert.equal(taskDescriptionPreview("  Primul rând\n\nAl doilea rând  "), "Primul rând Al doilea rând");
assert.equal(taskDescriptionPreview("ș".repeat(100)), "ș".repeat(100));
assert.equal(taskDescriptionPreview("ș".repeat(101)), "ș".repeat(100) + "...");
assert.equal(taskDescriptionPreview("😀".repeat(101)), "😀".repeat(100) + "...");
assert.equal(taskDescriptionPreview(""), "");
// Filtering to "mine" must not reduce the full assignment set or duplicate shared tasks.
const mine = rows.filter(({ task }) => assignments.some((a) => a.assignment.taskId === task.id && a.memberSlug === "igor"));
assert.equal(groupTaskList(mine, assignments).find((g) => g.entries.some((e) => e.row.task.id === 3)).title,
  "Sarcini primite împreună de Andrei și Igor");
const tie = groupTaskList([row(2, 1), row(1, 1)], [assigned(1, 1, "Ștefan 😀"), assigned(2, 1, "Ștefan 😀")]);
assert.deepEqual(tie[0].entries.map(({ row }) => row.task.id), [1, 2]);
console.log("Task list: exact groups, ordering, counts, all completion states, mine and empty lists passed.");
