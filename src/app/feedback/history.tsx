"use client";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { feedbackBrands } from "../../lib/feedback-model";
import type { FeedbackHistoryBrand, FeedbackHistoryRow } from "../../lib/feedback-history";
import { ConfirmDialog } from "../b2b/ui";
import { markSeen } from "../member-seen";
import { NavigationIcon } from "../navigation-icon";
const dateFormat = new Intl.DateTimeFormat("ro-RO", { dateStyle: "medium", timeStyle: "short", timeZone: "Europe/Chisinau" });

export function FeedbackHistory({ brand, onlyUnread = false, commentId = null }: { brand: FeedbackHistoryBrand; onlyUnread?: boolean; commentId?: number | null }) {
  const [rows, setRows] = useState<FeedbackHistoryRow[]>([]);
  const [next, setNext] = useState<string | null>(null);
  const [loading, setLoading] = useState(true), [error, setError] = useState("");
  const [selected, setSelected] = useState<FeedbackHistoryRow | null>(null);
  const [seenError, setSeenError] = useState(false), [seenRetry, setSeenRetry] = useState(0);
  const opener = useRef<HTMLButtonElement | null>(null);
  const heading = useRef<HTMLHeadingElement | null>(null);
  const controller = useRef<AbortController | null>(null);
  const load = useCallback(async (before: string | null) => {
    controller.current?.abort();
    const pending = new AbortController(); controller.current = pending;
    setLoading(true); setError("");
    try {
      const params = new URLSearchParams({ brand }); if (before) params.set("before", before); if (onlyUnread) params.set("unread", "1");
      const response = await fetch(`/api/feedback/history?${params}`, { signal: pending.signal, cache: "no-store" });
      if (!response.ok) throw new Error("load");
      const data = await response.json();
      if (pending.signal.aborted) return;
      setRows(old => before ? [...old, ...data.comments.filter((row: FeedbackHistoryRow) => !old.some(existing => existing.id === row.id))] : data.comments);
      setNext(data.nextCursor);
    } catch { if (!pending.signal.aborted) setError("Istoricul nu a putut fi încărcat. Încearcă din nou."); }
    finally { if (!pending.signal.aborted) setLoading(false); }
  }, [brand, onlyUnread]);
  useEffect(() => { void load(null); return () => controller.current?.abort(); }, [load]);
  useEffect(() => {
    if (!commentId || !Number.isInteger(commentId) || commentId < 1) return;
    const pending = new AbortController();
    void fetch(`/api/feedback/history?comment=${commentId}`, { signal: pending.signal, cache: "no-store" }).then(async response => {
      if (!response.ok) throw Error(); const data = await response.json();
      if (!pending.signal.aborted) { if (data.comments[0]) setSelected(data.comments[0]); else setError("Feedbackul nu mai este disponibil."); }
    }).catch(() => { if (!pending.signal.aborted) setError("Feedbackul nu a putut fi deschis. Încearcă din nou."); });
    return () => pending.abort();
  }, [commentId]);
  const selectedId = selected?.id;
  useEffect(() => {
    if (!selectedId) return;
    let cancelled = false; setSeenError(false);
    void markSeen({ type: "feedback", ids: [selectedId] }).then(ok => {
      if (cancelled) return;
      setSeenError(!ok);
      if (ok) setRows(old => onlyUnread ? old.filter(r => r.id !== selectedId) : old.map(r => r.id === selectedId ? { ...r, unread: false } : r));
    });
    return () => { cancelled = true; };
  }, [selectedId, seenRetry, onlyUnread]);
  function close() { setSelected(null); const url = new URL(window.location.href); url.searchParams.delete("comment"); window.history.replaceState(null, "", url); requestAnimationFrame(() => { if (opener.current?.isConnected) opener.current.focus(); else heading.current?.focus(); }); }
  return <>
    <nav className="catalogue-submenu filter-nav brand-filter-nav" aria-label="Filtrează istoricul după brand">{[{ key: "all", label: "Toate" }, ...feedbackBrands].map(b => <Link key={b.key} href={`/feedback?tab=history&brand=${b.key}${onlyUnread ? "&unread=1" : ""}`} className={brand === b.key ? "active" : undefined} aria-current={brand === b.key ? "page" : undefined}>{b.label}</Link>)}</nav>
    <section className="panel content-section feedback-history-panel" aria-label="Istoric feedback">
      <div className="section-heading"><h2 ref={heading} tabIndex={-1}>Istoric feedback</h2><Link className={onlyUnread ? "button" : "button ghost"} href={`/feedback?tab=history&brand=${brand}${onlyUnread ? "" : "&unread=1"}`}>Nevăzute</Link></div>
      <div className="premium-list feedback-history-list">{rows.map(row => <button key={row.id} className="feedback-history-row" onClick={event => { opener.current = event.currentTarget; setSelected(row); }} aria-haspopup="dialog"><span className="feedback-history-brand">{feedbackBrands.find(b => b.key === row.brand)?.label ?? row.brand}</span><strong className="feedback-history-product">{row.product}{row.unread && <span className="unread-dot" aria-label="Nevăzut" />}</strong><span className="feedback-history-comment"><span className="clamped">{row.body}</span></span><time dateTime={row.createdAt}>{dateFormat.format(new Date(row.createdAt))}</time><NavigationIcon name="chevron" /></button>)}</div>
      {loading && <p className="empty-state" role="status">Se încarcă feedbackurile…</p>}
      {!loading && !error && !rows.length && <p className="empty-state">Nu există feedback pentru selecția curentă.</p>}
      {error && <div><p className="entry-edit-error" role="alert">{error}</p><button className="button ghost" type="button" onClick={() => void load(next)}>Reîncearcă</button></div>}
      {next && !error && <button className="button ghost" type="button" disabled={loading} onClick={() => void load(next)}>Încarcă mai multe</button>}
    </section>
    {selected && <ConfirmDialog title={selected.product} busy={false} onClose={close} className="feedback-message-dialog"><p className="feedback-secondary">{feedbackBrands.find(b => b.key === selected.brand)?.label} · {dateFormat.format(new Date(selected.createdAt))}</p><p className="feedback-full-comment">{selected.body}</p>{seenError && <div role="alert" className="read-state-error">Nu s-a putut marca drept văzut. <button className="button ghost" onClick={() => setSeenRetry(n => n + 1)}>Reîncearcă</button></div>}</ConfirmDialog>}
  </>;
}
