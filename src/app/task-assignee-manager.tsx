"use client";

import { createContext, useContext, useLayoutEffect, useMemo, useRef, useState, useTransition, type Dispatch, type SetStateAction, type ReactNode, type RefObject, type TransitionStartFunction } from "react";
import { useSearchParams } from "next/navigation";
import { setTaskAssignee, setTaskAssigneeCompletion } from "./actions";
import { useEntryModalState } from "./entry-modal-state";
import { optimisticTaskAssignees, type TaskAssigneeState, type TaskAssignmentChange } from "../lib/task-assignment-state";

type Props = {
  taskId: number;
  brand: string;
  assignments: TaskAssigneeState[];
  members: { id: number; slug: string; name: string }[];
  canManage: boolean;
  viewerSlug: string;
};

type MutationState = {
  source: string;
  assignments: TaskAssigneeState[];
  busy: boolean;
  error: string;
  retry: TaskAssignmentChange | null;
  focusMember: string | null;
};
const ResponsibilityContext = createContext<{
  mutations: Record<number, MutationState>;
  setMutations: Dispatch<SetStateAction<Record<number, MutationState>>>;
  locked: RefObject<Set<number>>;
  transitioning: boolean;
  startTransition: TransitionStartFunction;
} | null>(null);

/** Kept above groups so regrouping a task cannot lose its pending/error state. */
export function TaskResponsibilityProvider({ children }: { children: ReactNode }) {
  const [mutations, setMutations] = useState<Record<number, MutationState>>({});
  const locked = useRef(new Set<number>());
  const [transitioning, startTransition] = useTransition();
  const value = useMemo(() => ({ mutations, setMutations, locked, transitioning, startTransition }), [mutations, transitioning]);
  return <ResponsibilityContext.Provider value={value}>{children}</ResponsibilityContext.Provider>;
}

export function TaskAssigneeManager({ taskId, brand, assignments, members, canManage, viewerSlug }: Props) {
  const context = useContext(ResponsibilityContext);
  if (!context) throw new Error("Task responsibility provider is required");
  const { mutations, setMutations, locked, transitioning, startTransition } = context;
  const source = JSON.stringify(assignments);
  const local = mutations[taskId];
  const busy = !!local?.busy || (transitioning && !!local?.focusMember);
  const error = local?.error ?? "";
  const retry = local?.retry;
  const root = useRef<HTMLElement>(null);
  const params = useSearchParams();
  const { draft } = useEntryModalState();
  const displayed = local && (busy || local.source === source) ? local.assignments : assignments;

  function update(patch: Partial<MutationState>) {
    setMutations(current => {
      const previous = current[taskId] ?? { source, assignments, busy: false, error: "", retry: null, focusMember: null };
      return { ...current, [taskId]: { ...previous, ...patch } };
    });
  }

  useLayoutEffect(() => {
    if (busy || !local?.focusMember) return;
    const member = local.focusMember;
    const control = Array.from(root.current?.querySelectorAll<HTMLButtonElement>("button[data-task-member]") ?? [])
      .find(button => button.dataset.taskMember === member && !button.disabled);
    (control ?? root.current?.querySelector<HTMLButtonElement>("button:not(:disabled)"))?.focus({ preventScroll: true });
    setMutations(current => ({ ...current, [taskId]: { ...current[taskId], focusMember: null } }));
  }, [busy, local?.focusMember, setMutations, taskId]);

  function changeResponsibility(change: TaskAssignmentChange) {
    if (locked.current.has(taskId) || busy || !canManage) return;
    const previous = displayed;
    const next = optimisticTaskAssignees(previous, change, members);
    if (change.kind === "assigned" && !change.value && previous.length <= 1) {
      update({ error: "Sarcina trebuie să păstreze cel puțin un responsabil." });
      return;
    }
    const dirty = draft?.entryId === `entry-task-${taskId}`
      && (draft.title !== draft.originalTitle || draft.body !== draft.originalBody);
    const leavesList = next.every(member => member.completed)
      || (params.get("tasks") === "mine" && !next.some(member => member.memberSlug === viewerSlug));
    if (dirty && leavesList) {
      update({ error: "Salvează sau anulează editarea descrierii înainte de a muta sarcina din această listă." });
      return;
    }
    locked.current.add(taskId);
    update({ source, assignments: next, busy: true, error: "", retry: null, focusMember: change.memberSlug });
    startTransition(async () => {
      try {
        const form = new FormData();
        form.set("id", String(taskId));
        form.set("brand", brand);
        form.set("memberSlug", change.memberSlug);
        form.set(change.kind, String(change.value));
        const result = await (change.kind === "assigned" ? setTaskAssignee : setTaskAssigneeCompletion)(form);
        update({ source, assignments: result.assignees ?? previous,
          error: result.ok ? "" : result.error ?? "Modificarea nu a putut fi salvată. Încearcă din nou.",
          retry: !result.ok && !result.assignees ? change : null });
      } catch {
        update({ source, assignments: previous, error: "Modificarea nu a putut fi salvată. Încearcă din nou.", retry: change });
      } finally {
        locked.current.delete(taskId);
        update({ busy: false });
      }
    });
  }

  return <section ref={root} className="task-assignee-manager" aria-busy={busy}>
    <h4>Responsabili</h4>
    <div className="task-assignee-list manager">{members.map(member => {
      const selected = displayed.find(assigned => assigned.memberId === member.id);
      if (!selected) return canManage ? <button key={member.id} type="button" data-task-member={member.slug} className="task-member-chip unassigned" disabled={busy} aria-label={`Adaugă responsabilul ${member.name}`} onClick={() => changeResponsibility({ kind: "assigned", memberSlug: member.slug, value: true })}><span aria-hidden="true">+</span>{member.name}</button> : null;
      if (!canManage) return <span key={member.id} className={`task-member-chip ${selected.completed ? "completed" : "incomplete"}`}><span aria-hidden="true">{selected.completed ? "✓" : "×"}</span>{member.name}</span>;
      const completionLabel = `${selected.completed ? "Marchează nefinalizat" : "Marchează finalizat"} pentru ${member.name}`;
      return <div className={`task-member-control ${selected.completed ? "completed" : "incomplete"}`} key={member.id}>
        <button type="button" data-task-member={member.slug} className={`task-member-chip ${selected.completed ? "completed" : "incomplete"}`} disabled={busy} title={completionLabel} aria-label={completionLabel} onClick={() => changeResponsibility({ kind: "completed", memberSlug: member.slug, value: !selected.completed })}><span aria-hidden="true">{selected.completed ? "✓" : "×"}</span>{member.name} · {selected.completed ? "Finalizat" : "De făcut"}</button>
        <button type="button" data-task-member={member.slug} className="task-member-remove" disabled={busy || displayed.length <= 1} title={displayed.length <= 1 ? "Trebuie să rămână cel puțin un responsabil." : `Elimină responsabilul ${member.name}`} aria-label={`Elimină responsabilul ${member.name}`} onClick={() => changeResponsibility({ kind: "assigned", memberSlug: member.slug, value: false })}>Elimină</button>
      </div>;
    })}</div>
    {busy && <p role="status" aria-live="polite">Se salvează…</p>}
    {error && <div className="task-assignee-error" role="alert"><p>{error}</p>{retry && <button type="button" className="text-button" disabled={busy} onClick={() => changeResponsibility(retry)}>Reîncearcă</button>}</div>}
    {canManage && <p>Trebuie să rămână cel puțin un responsabil. Când toți sunt marcați finalizați, sarcina trece în Istoric.</p>}
  </section>;
}
