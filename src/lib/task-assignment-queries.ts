import { sql } from "drizzle-orm";

/** Run together in one READ COMMITTED transaction: the task row serializes edits. */
export function taskAssignmentQueries(taskId: number, brand: string, memberId: number, assigned: boolean) {
  const lock = sql`select id from tasks where id = ${taskId} and brand = ${brand} and deleted_at is null for update`;
  const mutation = assigned
    ? sql`insert into task_assignees (task_id, member_id)
        select id, ${memberId} from tasks where id = ${taskId} and brand = ${brand} and deleted_at is null
        on conflict (task_id, member_id) do nothing returning id`
    : sql`delete from task_assignees as target
        where target.task_id = ${taskId} and target.member_id = ${memberId}
          and exists (select 1 from tasks where id = target.task_id and brand = ${brand} and deleted_at is null)
          and exists (select 1 from task_assignees as other
            where other.task_id = target.task_id and other.member_id <> target.member_id)
        returning target.id`;
  return [lock, mutation] as const;
}
