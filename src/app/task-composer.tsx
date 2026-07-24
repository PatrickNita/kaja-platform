"use client";

import { useState } from "react";
import { createTask } from "./actions";
import { AutoResizeTextarea } from "./comment-textarea";

type Brand = "kaja" | "hexenwerk" | "virginia";
type Member = { id: number; name: string; slug: string };
const brands = [
  { key: "kaja", label: "KAJA" },
  { key: "hexenwerk", label: "HEXENWERK" },
  { key: "virginia", label: "VIRGINIA" },
] as const;

export function TaskComposer({ initialBrand, members }: { initialBrand?: Brand; members: Member[] }) {
  const [brand, setBrand] = useState<Brand | "">(initialBrand ?? "");
  const [selected, setSelected] = useState<string[]>([]);

  const toggle = (slug: string) => {
    setSelected((current) => current.includes(slug) ? current.filter((entry) => entry !== slug) : [...current, slug]);
  };

  return <form action={createTask} className="form task-composer">
    {brand && <input type="hidden" name="brand" value={brand} />}
    {selected.map((slug) => <input key={slug} type="hidden" name="assignees" value={slug} />)}
    <fieldset className="task-assignee-picker task-brand-picker">
      <legend>Brandul sarcinii</legend>
      <div className="task-assignee-list">
        {brands.map((entry) => <button key={entry.key} type="button" className={`task-member-chip picker${brand === entry.key ? " selected" : ""}`} aria-pressed={brand === entry.key} onClick={() => setBrand(entry.key)}>
          <span aria-hidden="true">{brand === entry.key ? "✓" : "+"}</span>
          {entry.label}
        </button>)}
      </div>
    </fieldset>
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
    <button className="button" disabled={!brand || selected.length === 0}>Adaugă sarcina</button>
  </form>;
}
