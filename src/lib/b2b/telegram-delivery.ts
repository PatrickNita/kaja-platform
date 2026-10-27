export type NotificationLine = {
  id: number;
  name: string;
  flavor: string;
  quantity: number;
  price: number;
};
export type OrderNotification = {
  kind: "created" | "edited";
  orderId: number;
  at: string;
  actor: string;
  location: { name: string; address: string; idno?: string | null };
  previousLocation?: { name: string; address: string };
  lines: NotificationLine[];
  previous: NotificationLine[];
  total: number;
};
const clean = (value: string) => value.replace(/[\r\n\t]+/g, " ").trim();
const money = (value: number) => (value / 100).toLocaleString("ro-RO") + " MDL";
export function notificationMessages(event: OrderNotification): string[] {
  const date = new Intl.DateTimeFormat("ro-RO", {
    timeZone: "Europe/Chisinau",
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(event.at));
  const text = [
    `${event.kind === "created" ? "COMANDĂ NOUĂ" : "COMANDĂ MODIFICATĂ"} #${event.orderId}`,
    `${clean(event.location.name)} · ${clean(event.location.address)}`,
    `IDNO: ${event.location.idno?.trim() ? clean(event.location.idno) : "—"}`,
    date,
  ];
  if (event.actor !== "Local")
    text.push(
      `${event.kind === "created" ? "Plasată" : "Modificată"} de: ${clean(event.actor)}`,
    );
  if (event.kind === "edited") {
    text.push("", "MODIFICĂRI");
    if (event.previousLocation) text.push(`Local: ${clean(event.previousLocation.name)} · ${clean(event.previousLocation.address)} → ${clean(event.location.name)} · ${clean(event.location.address)}`);
    const ids = new Set(
      [...event.previous, ...event.lines].map((line) => line.id),
    );
    for (const id of ids) {
      const before = event.previous.find((line) => line.id === id);
      const after = event.lines.find((line) => line.id === id);
      if (before?.quantity === after?.quantity) continue;
      const line = after ?? before!;
      text.push(
        `${clean(line.name)} · ${clean(line.flavor)}: ${before?.quantity ?? 0} → ${after?.quantity ?? 0} buc.`,
      );
    }
  }
  text.push("", "PRODUSE");
  for (const line of event.lines)
    text.push(
      `${clean(line.name)} · ${clean(line.flavor)} — ${line.quantity} buc. × ${money(line.price)} = ${money(line.quantity * line.price)}`,
    );
  text.push(
    "",
    `TOTAL: ${event.lines.reduce((sum, line) => sum + line.quantity, 0)} buc. · ${money(event.total)}`,
  );
  const chunks: string[] = [];
  let chunk = "";
  for (const row of text) {
    let remaining = row;
    while (remaining.length > 3800) {
      if (chunk) {
        chunks.push(chunk);
        chunk = "";
      }
      chunks.push(remaining.slice(0, 3800));
      remaining = remaining.slice(3800);
    }
    if (chunk.length + remaining.length + 1 > 3800) {
      chunks.push(chunk);
      chunk = "";
    }
    chunk += (chunk ? "\n" : "") + remaining;
  }
  if (chunk) chunks.push(chunk);
  return chunks.map((part, index) =>
    chunks.length > 1 ? `${part}\n\n(${index + 1}/${chunks.length})` : part,
  );
}
export type Execute = (
  text: string,
  params: unknown[],
) => Promise<Record<string, unknown>[]>;
export async function deliverNotification(
  id: number,
  execute: Execute,
  token: string,
  chatId: string,
  sendFetch: typeof fetch = fetch,
) {
  if (!token || !/^-100\d+$/.test(chatId))
    throw new Error("B2B Telegram configuration missing");
  const lease = crypto.randomUUID();
  const [row] = await execute(
    `update b2b_notifications set processing_token=$2::uuid,processing_at=now() where id=$1 and sent_at is null and (processing_at is null or processing_at < now()-interval '5 minutes') returning payload,sent_parts`,
    [id, lease],
  );
  if (!row) {
    const [pending] = await execute(
      "select id from b2b_notifications where id=$1 and sent_at is null",
      [id],
    );
    if (pending) throw new Error("B2B notification is being processed");
    return;
  }
  try {
    const messages = notificationMessages(row.payload as OrderNotification);
    for (let part = Number(row.sent_parts); part < messages.length; part++) {
      const response = await sendFetch(
        `https://api.telegram.org/bot${token}/sendMessage`,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            chat_id: chatId,
            text: messages[part],
            disable_web_page_preview: true,
          }),
          signal: AbortSignal.timeout(20000),
        },
      );
      const result = await response.json().catch(() => null);
      if (!response.ok || !result?.ok)
        throw new Error(`Telegram rejected B2B message (${response.status})`);
      await execute(
        "update b2b_notifications set sent_parts=$3,processing_at=now() where id=$1 and processing_token=$2::uuid",
        [id, lease, part + 1],
      );
    }
    await execute(
      "update b2b_notifications set sent_at=now(),processing_token=null,processing_at=null,last_error=null where id=$1 and processing_token=$2::uuid",
      [id, lease],
    );
  } catch {
    await execute(
      "update b2b_notifications set processing_token=null,processing_at=null,last_error='Telegram delivery failed; retry required' where id=$1 and processing_token=$2::uuid",
      [id, lease],
    );
    // Never propagate fetch errors containing the credential-bearing request URL.
    throw new Error("B2B Telegram delivery failed");
  }
}
