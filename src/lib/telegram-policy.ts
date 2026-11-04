/** Tasks notify only at creation. Other entities retain their existing policy. */
export function allowsTelegramNotification(event: { entityType: string; action: string }) {
  return event.entityType !== "task" || event.action === "created";
}
