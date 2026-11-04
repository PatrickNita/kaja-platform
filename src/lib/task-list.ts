type TaskRow = { task: { id: number; createdAt: Date } };
type AssigneeRow = { assignment: { taskId: number; memberId: number; completed: boolean }; memberName: string; memberSlug: string };

const names = new Intl.Collator("ro", { sensitivity: "base" });

export function taskListState(assignments: AssigneeRow[]) {
  const completed = assignments.filter(({ assignment }) => assignment.completed).length;
  if (assignments.length > 1) return `${completed}/${assignments.length} finalizate`;
  return completed ? "Finalizată" : "De făcut";
}

/** Group by the complete assignee set, including in the current member's list. */
export function groupTaskList<T extends TaskRow, A extends AssigneeRow>(rows: T[], assignments: A[]) {
  const byTask = new Map<number, A[]>();
  for (const assignment of assignments) {
    const current = byTask.get(assignment.assignment.taskId) ?? [];
    current.push(assignment);
    byTask.set(assignment.assignment.taskId, current);
  }
  const groups = new Map<string, { key: string; title: string; names: string; entries: { row: T; assignments: A[] }[] }>();
  for (const row of [...rows].sort((a, b) => a.task.createdAt.getTime() - b.task.createdAt.getTime() || a.task.id - b.task.id)) {
    const assigned = [...(byTask.get(row.task.id) ?? [])].sort((a, b) => names.compare(a.memberName, b.memberName) || a.assignment.memberId - b.assignment.memberId);
    const key = assigned.map(({ assignment }) => assignment.memberId).sort((a, b) => a - b).join(",") || "unassigned";
    const memberNames = assigned.map(({ memberName }) => memberName);
    const label = memberNames.length <= 1 ? memberNames[0] : `${memberNames.slice(0, -1).join(", ")} și ${memberNames.at(-1)}`;
    const group = groups.get(key) ?? {
      key,
      title: label ? `Sarcini primite ${memberNames.length > 1 ? "împreună " : ""}de ${label}` : "Sarcini fără responsabili",
      names: memberNames.join(", "),
      entries: [],
    };
    group.entries.push({ row, assignments: assigned });
    groups.set(key, group);
  }
  return [...groups.values()].sort((a, b) => names.compare(a.names, b.names) || a.key.localeCompare(b.key));
}
