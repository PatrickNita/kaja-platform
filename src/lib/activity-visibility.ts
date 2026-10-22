import { sql } from "drizzle-orm";
import { activity, updates, tasks, attachments, workspaceItems } from "./schema";
const deletionActions = ["deleted", "comment_deleted", "image_deleted"];
export function activityVisibility(slug: string | null, source: "internal" | "deleted") {
  if (!slug || !["patrick","ionut","andrei","igor"].includes(slug)) return sql`false`;
  const actions = sql.join(deletionActions.map(action => sql`${action}`),sql`, `);
  if (source === "deleted") return slug === "patrick" ? sql`${activity.action} in (${actions})` : sql`false`;
  return sql`${activity.action} not in (${actions}) and (
    (${activity.entityType}='update' and exists(select 1 from ${updates} where ${updates.id}=${activity.entityId} and ${updates.brand}=${activity.brand} and ${updates.deletedAt} is null)) or
    (${activity.entityType}='task' and exists(select 1 from ${tasks} where ${tasks.id}=${activity.entityId} and ${tasks.brand}=${activity.brand} and ${tasks.deletedAt} is null)) or
    (${activity.entityType}='attachment' and exists(select 1 from ${attachments} where ${attachments.id}=${activity.entityId} and ${attachments.brand}=${activity.brand} and ${attachments.deletedAt} is null)) or
    exists(select 1 from ${workspaceItems} where ${workspaceItems.id}=${activity.entityId} and ${workspaceItems.brand}=${activity.brand} and ${workspaceItems.section}=${activity.entityType} and ${workspaceItems.deletedAt} is null)
  )`;
}
