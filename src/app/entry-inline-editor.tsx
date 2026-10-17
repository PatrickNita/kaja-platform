"use client";

import type { ReactNode } from "react";
import { useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import { AutoResizeTextarea } from "./comment-textarea";
import { useEntryModalState } from "./entry-modal-state";

type HiddenField = {
  name: string;
  value: string | number;
};

type Props = {
  entryId: string;
  title: string;
  body?: string;
  authorControls: ReactNode;
  closeLabel: string;
  detailsMedia?: ReactNode;
  children: ReactNode;
  editAction?: (formData: FormData) => Promise<void>;
  hiddenFields?: HiddenField[];
  deleteControl?: ReactNode;
};

function errorMessage(error: unknown) {
  if (error instanceof Error && /^(Sesiunea|Poți|Nu ai|Doar Patrick|Înregistrarea)/.test(error.message)) return error.message;
  return "Modificarea nu a putut fi salvată. Încearcă din nou.";
}

export function EntryInlineEditor({ entryId, title, body, authorControls, closeLabel, detailsMedia, children, editAction, hiddenFields = [], deleteControl }: Props) {
  const root = useRef<HTMLDivElement>(null);
  const generatedId = useId().replaceAll(":", "");
  const formId = `entry-edit-${generatedId}`;
  const [error, setError] = useState<string | null>(null);
  const { activeEntryId, draft, saving, beginEditing, closeEntry, setSaving, updateDraft, stopEditing, cancelEditing } = useEntryModalState();
  const editing = draft?.entryId === entryId;
  const dirty = editing && (draft.title !== draft.originalTitle || draft.body !== draft.originalBody);
  const valid = editing && draft.title.trim().length > 0 && draft.body.trim().length > 0;

  const cancel = () => {
    if (saving) return;
    cancelEditing();
    setError(null);
  };

  useEffect(() => {
    if (activeEntryId !== entryId || !editing) {
      setError(null);
    }
  }, [activeEntryId, editing, entryId]);

  useLayoutEffect(() => {
    if (!editing) return;
    root.current?.querySelector<HTMLTextAreaElement>('textarea[name="title"]')?.focus({ preventScroll: true });
  }, [editing]);

  const save = async (formData: FormData) => {
    if (!editAction || !dirty || !valid || saving) return;
    setSaving(true);
    setError(null);
    try {
      await editAction(formData);
      stopEditing();
    } catch (saveError) {
      setError(errorMessage(saveError));
      setSaving(false);
    }
  };

  return <div ref={root} className={`entry-inline-editor${editing ? " is-editing" : ""}`} data-entry-inline-editor data-entry-saving={saving ? "true" : undefined}>
    <div className="entry-modal-header">
      <div className="entry-modal-title-group">
        {editing ? <AutoResizeTextarea form={formId} className="field-title entry-inline-title" name="title" value={draft.title} onChange={(event) => updateDraft("title", event.currentTarget.value)} required maxLength={160} aria-label="Titlu" /> : <h3 className="item-title">{title}</h3>}
        {authorControls}
      </div>
      <button type="button" className="entry-modal-close" data-entry-close aria-label={closeLabel} disabled={saving} onClick={() => { if (!saving) closeEntry(); }}>×</button>
    </div>

    <div className="entry-card-content">
      {detailsMedia}
      {editing ? <AutoResizeTextarea form={formId} className="entry-inline-body" name="body" value={draft.body} onChange={(event) => updateDraft("body", event.currentTarget.value)} required maxLength={4000} aria-label="Descriere" /> : body ? <p>{body}</p> : null}
      {children}

      {editAction && <>
        <form id={formId} action={save} className="entry-inline-form" aria-label={`Modifică ${title}`} aria-busy={saving}>
          {hiddenFields.map((field) => <input key={field.name} type="hidden" name={field.name} value={field.value} />)}
        </form>
        {error && <p className="entry-edit-error" role="alert" aria-live="polite">{error}</p>}
        <div className={`card-actions${editing ? " editing" : ""}`}>
          {editing ? <>
            <button className="button" type="submit" form={formId} disabled={saving || !dirty || !valid}>{saving ? "Se salvează…" : "Salvează modificările"}</button>
            <button className="button ghost" type="button" onClick={cancel} disabled={saving}>Anulează</button>
          </> : <>
            <button className="button ghost" type="button" onClick={(event) => { event.preventDefault(); setError(null); beginEditing(entryId, title, body ?? ""); }}>Modifică</button>
            {deleteControl}
          </>}
        </div>
      </>}
    </div>
  </div>;
}
