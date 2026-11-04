export type TaskDigestEntry = {
  taskId: number;
  eventIds: number[];
  title: string;
  createdAt: Date;
  assignees: { id: number; name: string }[];
};

export type TelegramDigestMessage = {
  text: string;
  entities: { type: "bold"; offset: number; length: number }[];
  eventIds: number[];
};

const collator = new Intl.Collator("ro", { sensitivity: "base" });

/** One exact assignee set per group; Telegram offsets are UTF-16 code units. */
export function formatNewTaskMessages(entries: TaskDigestEntry[]): TelegramDigestMessage[] {
  const groups = new Map<string, { names: string[]; tasks: TaskDigestEntry[] }>();
  for (const entry of [...entries].sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime() || a.taskId - b.taskId)) {
    const assignees = [...new Map(entry.assignees.map((member) => [member.id, member])).values()]
      .sort((a, b) => collator.compare(a.name, b.name) || a.id - b.id);
    if (!assignees.length) continue;
    const key = assignees.map((member) => member.id).sort((a, b) => a - b).join(",");
    const group = groups.get(key) ?? { names: assignees.map((member) => member.name), tasks: [] };
    const existing = group.tasks.find((task) => task.taskId === entry.taskId);
    if (existing) existing.eventIds.push(...entry.eventIds);
    else group.tasks.push({ ...entry, eventIds: [...entry.eventIds] });
    groups.set(key, group);
  }
  const messages: TelegramDigestMessage[] = [];
  for (const group of [...groups.values()].sort((a, b) => collator.compare(a.names.join(", "), b.names.join(", ")))) {
    const names = group.names.length === 1 ? group.names[0]
      : `${group.names.slice(0, -1).join(", ")} și ${group.names.at(-1)}`;
    const header = `Sarcini primite ${group.names.length > 1 ? "împreună " : ""}de ${names}`;
    const fresh = (): TelegramDigestMessage => ({ text: header, entities: [{ type: "bold", offset: 0, length: header.length }], eventIds: [] });
    let message = fresh();
    for (const task of group.tasks) {
      const line = `\n- ${task.title.replace(/\s+/g, " ").trim()}`;
      // Task titles are limited to 160 characters by the creation form.
      if (header.length + line.length > 4096) throw new Error("Task digest entry exceeds Telegram limit");
      if (message.text.length + line.length > 4096) {
        messages.push(message);
        message = fresh();
      }
      message.text += line;
      message.eventIds.push(...task.eventIds);
    }
    messages.push(message);
  }
  return messages;
}

/** Save each successful chunk before attempting the next one on queue retries. */
export async function deliverDigestMessages(
  messages: TelegramDigestMessage[],
  callbacks: {
    isCurrent: () => Promise<boolean>;
    send: (message: TelegramDigestMessage) => Promise<void>;
    acknowledge: (eventIds: number[]) => Promise<void>;
  },
) {
  for (const message of messages) {
    if (!await callbacks.isCurrent()) return false;
    await callbacks.send(message);
    await callbacks.acknowledge(message.eventIds);
  }
  return true;
}
