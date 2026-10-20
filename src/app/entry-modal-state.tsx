"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useReducer, useRef, type ReactNode } from "react";

type EntryDraft = {
  entryId: string;
  title: string;
  body: string;
  originalTitle: string;
  originalBody: string;
  flavor?: string;
  originalFlavor?: string;
};

type DraftField = "title" | "body" | "flavor";

type EntryModalState = {
  activeEntryId: string | null;
  draft: EntryDraft | null;
  saving: boolean;
  openEntry: (entryId: string) => void;
  closeEntry: () => void;
  beginEditing: (entryId: string, title: string, body: string, flavor?: string) => void;
  updateDraft: (field: DraftField, value: string) => void;
  stopEditing: () => void;
  cancelEditing: () => void;
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
  | { type: "begin-editing"; entryId: string; title: string; body: string; flavor?: string }
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
          flavor: action.flavor,
          originalFlavor: action.flavor,
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

export function EntryModalStateProvider({ children, memberSlug }: { children: ReactNode; memberSlug: string }) {
  const [state, dispatch] = useReducer(reducer, initialState);
  const stateRef = useRef(state);
  const editingLocation = useRef<{ url: string; historyState: unknown } | null>(null);
  stateRef.current = state;
  const storageKey = useCallback((entryId: string) => `kaja-draft:${memberSlug}:${entryId}`, [memberSlug]);
  const clearDraft = useCallback(() => {
    const draft = stateRef.current.draft;
    if (draft) {
      try { sessionStorage.removeItem(storageKey(draft.entryId)); } catch { /* Storage can be disabled. */ }
    }
    stateRef.current = { ...stateRef.current, draft: null };
  }, [storageKey]);
  const confirmDiscard = useCallback(() => {
    const { draft, saving } = stateRef.current;
    if (saving) return false;
    if (draft && (draft.title !== draft.originalTitle || draft.body !== draft.originalBody || draft.flavor !== draft.originalFlavor)
      && !window.confirm("Ai modificări nesalvate. Renunți la ele?")) return false;
    clearDraft();
    return true;
  }, [clearDraft]);

  useEffect(() => {
    if (!state.draft) return;
    try { sessionStorage.setItem(storageKey(state.draft.entryId), JSON.stringify(state.draft)); } catch { /* Keep editing without storage. */ }
  }, [state.draft, storageKey]);

  useEffect(() => {
    const url = new URL(window.location.href);
    if (url.searchParams.get("view") === "updates") {
      url.searchParams.set("view", "activity");
      window.history.replaceState(window.history.state, "", url);
    }
  }, []);

  useEffect(() => {
    const beforeUnload = (event: BeforeUnloadEvent) => {
      const { draft, saving } = stateRef.current;
      if (saving || (draft && (draft.title !== draft.originalTitle || draft.body !== draft.originalBody || draft.flavor !== draft.originalFlavor))) {
        event.preventDefault();
        event.returnValue = "";
      }
    };
    const navigate = (event: MouseEvent) => {
      if (event.defaultPrevented || event.button !== 0 || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
      const anchor = event.target instanceof Element ? event.target.closest<HTMLAnchorElement>("a[href]") : null;
      if (!anchor || anchor.hasAttribute("download") || (anchor.target && anchor.target !== "_self")) return;
      if (!confirmDiscard()) { event.preventDefault(); event.stopPropagation(); }
      else dispatch({ type: "stop-editing" });
    };
    const historyNavigation = (event: PopStateEvent) => {
      if (!stateRef.current.draft && !stateRef.current.saving) return;
      if (!confirmDiscard()) {
        event.stopImmediatePropagation();
        const previous = editingLocation.current;
        if (previous) window.history.pushState(previous.historyState, "", previous.url);
      } else dispatch({ type: "stop-editing" });
    };
    window.addEventListener("beforeunload", beforeUnload);
    window.addEventListener("popstate", historyNavigation, true);
    document.addEventListener("click", navigate, true);
    return () => {
      window.removeEventListener("beforeunload", beforeUnload);
      window.removeEventListener("popstate", historyNavigation, true);
      document.removeEventListener("click", navigate, true);
    };
  }, [confirmDiscard]);

  const openEntry = useCallback((entryId: string) => {
    if (stateRef.current.activeEntryId !== entryId && !confirmDiscard()) return;
    dispatch({ type: "open", entryId });
  }, [confirmDiscard]);

  const closeEntry = useCallback(() => {
    if (!confirmDiscard()) return;
    if (typeof window !== "undefined" && window.location.hash) {
      window.history.replaceState(window.history.state, "", `${window.location.pathname}${window.location.search}`);
    }
    dispatch({ type: "close" });
  }, [confirmDiscard]);

  const beginEditing = useCallback((entryId: string, title: string, body: string, flavor?: string) => {
    editingLocation.current = { url: window.location.href, historyState: window.history.state };
    dispatch({ type: "begin-editing", entryId, title, body, flavor });
    try {
      const saved = JSON.parse(sessionStorage.getItem(storageKey(entryId)) || "null") as EntryDraft | null;
      if (saved?.entryId === entryId && typeof saved.title === "string" && typeof saved.body === "string") {
        dispatch({ type: "update-draft", field: "title", value: saved.title });
        dispatch({ type: "update-draft", field: "body", value: saved.body });
        if (flavor !== undefined && typeof saved.flavor === "string") dispatch({ type: "update-draft", field: "flavor", value: saved.flavor });
      }
    } catch { /* Ignore unavailable or invalid stored drafts. */ }
  }, [storageKey]);

  const updateDraft = useCallback((field: DraftField, value: string) => {
    dispatch({ type: "update-draft", field, value });
  }, []);

  const stopEditing = useCallback(() => {
    clearDraft();
    dispatch({ type: "stop-editing" });
  }, [clearDraft]);
  const cancelEditing = useCallback(() => {
    if (confirmDiscard()) dispatch({ type: "stop-editing" });
  }, [confirmDiscard]);

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
    cancelEditing,
    setSaving,
  }), [beginEditing, cancelEditing, closeEntry, openEntry, setSaving, state.activeEntryId, state.draft, state.saving, stopEditing, updateDraft]);

  return <EntryModalStateContext.Provider value={value}>{children}</EntryModalStateContext.Provider>;
}

export function useEntryModalState() {
  const state = useContext(EntryModalStateContext);
  if (!state) throw new Error("Entry modal state must be used inside EntryModalStateProvider.");
  return state;
}
