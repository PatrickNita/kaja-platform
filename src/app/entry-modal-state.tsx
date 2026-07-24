"use client";

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";

type EntryDraft = {
  entryId: string;
  title: string;
  body: string;
};

type DraftField = "title" | "body";

type EntryModalState = {
  activeEntryId: string | null;
  draft: EntryDraft | null;
  setActiveEntryId: (entryId: string | null) => void;
  beginEditing: (entryId: string, title: string, body: string) => void;
  updateDraft: (field: DraftField, value: string) => void;
  stopEditing: () => void;
};

const EntryModalStateContext = createContext<EntryModalState | null>(null);

export function EntryModalStateProvider({ children }: { children: ReactNode }) {
  const [activeEntryId, setActiveEntryId] = useState<string | null>(null);
  const [draft, setDraft] = useState<EntryDraft | null>(null);

  const beginEditing = useCallback((entryId: string, title: string, body: string) => {
    setDraft({ entryId, title, body });
  }, []);

  const updateDraft = useCallback((field: DraftField, value: string) => {
    setDraft((current) => current ? { ...current, [field]: value } : current);
  }, []);

  const stopEditing = useCallback(() => {
    setDraft(null);
  }, []);

  const value = useMemo(() => ({
    activeEntryId,
    draft,
    setActiveEntryId,
    beginEditing,
    updateDraft,
    stopEditing,
  }), [activeEntryId, beginEditing, draft, stopEditing, updateDraft]);

  return <EntryModalStateContext.Provider value={value}>{children}</EntryModalStateContext.Provider>;
}

export function useEntryModalState() {
  const state = useContext(EntryModalStateContext);
  if (!state) throw new Error("Entry modal state must be used inside EntryModalStateProvider.");
  return state;
}
