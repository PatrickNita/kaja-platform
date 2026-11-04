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

export function taskCompletionQueries(taskId: number, brand: string, memberId: number, completed: boolean, actorId: number) {
  const lock = sql`select id from tasks where id = ${taskId} and brand = ${brand} and deleted_at is null for update`;
  const mutation = sql`update task_assignees set completed = ${completed},
      completed_at = case when ${completed} then now() else null end,
      completed_by = case when ${completed} then ${actorId}::integer else null end
    where task_id = ${taskId} and member_id = ${memberId}
      and exists (select 1 from tasks where id = ${taskId} and brand = ${brand} and deleted_at is null)
    returning id`;
  return [lock, mutation] as const;
}

export function taskAssigneeSnapshotQuery(taskId: number) {
  return sql`select a.member_id as "memberId", m.slug as "memberSlug", m.name as "memberName", a.completed
    from task_assignees a join members m on m.id = a.member_id
    where a.task_id = ${taskId} order by m.name, m.id`;
}
