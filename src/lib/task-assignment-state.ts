export type TaskAssigneeState = {
  memberId: number;
  memberSlug: string;
  memberName: string;
  completed: boolean;
};

export type TaskAssignmentResult = {
  ok: boolean;
  assignees?: TaskAssigneeState[];
  error?: string;
};

export type TaskAssignmentChange = { memberSlug: string } & (
  | { kind: "assigned"; value: boolean }
  | { kind: "completed"; value: boolean }
);

export function optimisticTaskAssignees(
  assignees: TaskAssigneeState[],
  change: TaskAssignmentChange,
  members: { id: number; slug: string; name: string }[],
) {
  if (change.kind === "completed") return assignees.map(member => member.memberSlug === change.memberSlug ? { ...member, completed: change.value } : member);
  if (!change.value) return assignees.length > 1 ? assignees.filter(member => member.memberSlug !== change.memberSlug) : assignees;
  if (assignees.some(member => member.memberSlug === change.memberSlug)) return assignees;
  const member = members.find(member => member.slug === change.memberSlug);
  return member ? [...assignees, { memberId: member.id, memberSlug: member.slug, memberName: member.name, completed: false }] : assignees;
}
