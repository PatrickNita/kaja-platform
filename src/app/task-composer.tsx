"use client";

import { useState } from "react";
import { createTask } from "./actions";
import { AutoResizeTextarea } from "./comment-textarea";

type Brand = "kaja" | "hexenwerk" | "virginia";
type Member = { id: number; name: string; slug: string };

export function TaskComposer({ brand, members }: { brand: Brand; members: Member[] }) {
  const [selected, setSelected] = useState<string[]>([]);

  const toggle = (slug: string) => {
    setSelected((current) => current.includes(slug) ? current.filter((entry) => entry !== slug) : [...current, slug]);
  };

  return <form action={createTask} className="form task-composer">
    <input type="hidden" name="brand" value={brand} />
    {selected.map((slug) => <input key={slug} type="hidden" name="assignees" value={slug} />)}
    <AutoResizeTextarea className="field-title" name="title" required maxLength={160} placeholder="Titlu sarcină" />
    <AutoResizeTextarea name="body" required maxLength={4000} placeholder="Descrie sarcina." />
    <fieldset className="task-assignee-picker">
      <legend>Responsabili</legend>
      <div className="task-assignee-list">
        {members.map((member) => {
          const active = selected.includes(member.slug);
          return <button key={member.id} type="button" className={`task-member-chip picker${active ? " selected" : ""}`} aria-pressed={active} onClick={() => toggle(member.slug)}>
            <span aria-hidden="true">{active ? "✓" : "+"}</span>
            {member.name}
          </button>;
        })}
      </div>
    </fieldset>
    <button className="button" disabled={selected.length === 0}>Adaugă sarcina</button>
  </form>;
}
