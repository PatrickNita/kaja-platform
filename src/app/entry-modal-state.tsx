"use client";

import { createContext, useCallback, useContext, useMemo, useReducer, type ReactNode } from "react";

type EntryDraft = {
  entryId: string;
  title: string;
  body: string;
  originalTitle: string;
  originalBody: string;
};

type DraftField = "title" | "body";

type EntryModalState = {
  activeEntryId: string | null;
  draft: EntryDraft | null;
  saving: boolean;
  openEntry: (entryId: string) => void;
  closeEntry: () => void;
  beginEditing: (entryId: string, title: string, body: string) => void;
  updateDraft: (field: DraftField, value: string) => void;
  stopEditing: () => void;
  setSaving: (saving: boolean) => void;
};

const EntryModalStateContext = createContext<EntryModalState | null>(null);

type State = {
  activeEntryId: string | null;
  draft: EntryDraft | null;
  saving: boolean;
};

type Action =
  | { type: "open"; entryId: string }
  | { type: "close" }
  | { type: "begin-editing"; entryId: string; title: string; body: string }
  | { type: "update-draft"; field: DraftField; value: string }
  | { type: "stop-editing" }
  | { type: "set-saving"; saving: boolean };

const initialState: State = {
  activeEntryId: null,
  draft: null,
  saving: false,
};

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case "open":
      if (state.saving) return state;
      if (state.activeEntryId === action.entryId) return state;
      return { activeEntryId: action.entryId, draft: null, saving: false };
    case "close":
      if (state.saving) return state;
      return initialState;
    case "begin-editing":
      if (state.saving) return state;
      return {
        activeEntryId: action.entryId,
        draft: {
          entryId: action.entryId,
          title: action.title,
          body: action.body,
          originalTitle: action.title,
          originalBody: action.body,
        },
        saving: false,
      };
    case "update-draft":
      if (!state.draft) return state;
      return { ...state, draft: { ...state.draft, [action.field]: action.value } };
    case "stop-editing":
      return { ...state, draft: null, saving: false };
    case "set-saving":
      return { ...state, saving: action.saving };
  }
}

export function EntryModalStateProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, initialState);

  const openEntry = useCallback((entryId: string) => {
    dispatch({ type: "open", entryId });
  }, []);

  const closeEntry = useCallback(() => {
    if (typeof window !== "undefined" && window.location.hash) {
      window.history.replaceState(window.history.state, "", `${window.location.pathname}${window.location.search}`);
    }
    dispatch({ type: "close" });
  }, []);

  const beginEditing = useCallback((entryId: string, title: string, body: string) => {
    dispatch({ type: "begin-editing", entryId, title, body });
  }, []);

  const updateDraft = useCallback((field: DraftField, value: string) => {
    dispatch({ type: "update-draft", field, value });
  }, []);

  const stopEditing = useCallback(() => {
    dispatch({ type: "stop-editing" });
  }, []);

  const setSaving = useCallback((saving: boolean) => {
    dispatch({ type: "set-saving", saving });
  }, []);

  const value = useMemo(() => ({
    activeEntryId: state.activeEntryId,
    draft: state.draft,
    saving: state.saving,
    openEntry,
    closeEntry,
    beginEditing,
    updateDraft,
    stopEditing,
    setSaving,
  }), [beginEditing, closeEntry, openEntry, setSaving, state.activeEntryId, state.draft, state.saving, stopEditing, updateDraft]);

  return <EntryModalStateContext.Provider value={value}>{children}</EntryModalStateContext.Provider>;
}

export function useEntryModalState() {
  const state = useContext(EntryModalStateContext);
  if (!state) throw new Error("Entry modal state must be used inside EntryModalStateProvider.");
  return state;
}
