"use client";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { feedbackBrands } from "../../lib/feedback-model";
import type { FeedbackHistoryBrand, FeedbackHistoryRow } from "../../lib/feedback-history";
const dateFormat = new Intl.DateTimeFormat("ro-RO", { dateStyle: "medium", timeStyle: "short", timeZone: "Europe/Chisinau" });

export function FeedbackHistory({ brand }: { brand: FeedbackHistoryBrand }) {
  const [rows, setRows] = useState<FeedbackHistoryRow[]>([]);
  const [next, setNext] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const controller = useRef<AbortController | null>(null);
  const load = useCallback(async (before: string | null) => {
    controller.current?.abort();
    const pending = new AbortController(); controller.current = pending;
    setLoading(true); setError("");
    try {
      const params = new URLSearchParams({ brand }); if (before) params.set("before", before);
      const response = await fetch(`/api/feedback/history?${params}`, { signal: pending.signal, cache: "no-store" });
      if (!response.ok) throw new Error("load");
      const data = await response.json();
      if (pending.signal.aborted) return;
      setRows((old) => before ? [...old, ...data.comments.filter((row: FeedbackHistoryRow) => !old.some((existing) => existing.id === row.id))] : data.comments);
      setNext(data.nextCursor);
    } catch {
      if (!pending.signal.aborted) setError("Istoricul nu a putut fi încărcat. Încearcă din nou.");
    } finally { if (!pending.signal.aborted) setLoading(false); }
  }, [brand]);
  useEffect(() => { void load(null); return () => controller.current?.abort(); }, [load]);
  return <>
    <nav className="catalogue-submenu filter-nav brand-filter-nav" aria-label="Filtrează istoricul după brand">{[{ key: "all", label: "Toate" }, ...feedbackBrands].map((b) => <Link key={b.key} href={`/feedback?tab=history&brand=${b.key}`} className={brand === b.key ? "active" : undefined} aria-current={brand === b.key ? "page" : undefined}>{b.label}</Link>)}</nav>
    <section className="panel content-section feedback-history-panel" aria-label="Istoric feedback">
      <div className="panel-head"><h2>Istoric feedback</h2></div>
      <div className="feedback-history-list">{rows.map((row) => <HistoryRow key={row.id} row={row} />)}</div>
      {loading && <p className="feedback-secondary" role="status">Se încarcă feedbackurile…</p>}
      {!loading && !error && !rows.length && <p className="feedback-secondary">Nu există feedback pentru selecția curentă.</p>}
      {error && <div><p className="entry-edit-error" role="alert">{error}</p><button className="button ghost" type="button" onClick={() => void load(next)}>Reîncearcă</button></div>}
      {next && !error && <button className="button ghost" type="button" disabled={loading} onClick={() => void load(next)}>Încarcă mai multe</button>}
    </section>
  </>;
}
function HistoryRow({ row }: { row: FeedbackHistoryRow }) {
  const [expanded, setExpanded] = useState(false), [long, setLong] = useState(false);
  const text = useRef<HTMLParagraphElement>(null);
  useEffect(() => {
    const element = text.current; if (!element || expanded) return;
    const measure = () => setLong(element.scrollHeight > element.clientHeight + 1);
    measure(); const observer = new ResizeObserver(measure); observer.observe(element);
    return () => observer.disconnect();
  }, [expanded, row.body]);
  return <article className="feedback-history-row">
    <span className="feedback-history-brand">{feedbackBrands.find((b) => b.key === row.brand)?.label ?? row.brand}</span>
    <strong className="feedback-history-product">{row.product}</strong>
    <div className="feedback-history-comment"><p ref={text} className={expanded ? "expanded" : "clamped"}>{row.body}</p>{long && <button className="feedback-history-toggle" type="button" aria-expanded={expanded} onClick={() => setExpanded(!expanded)}>{expanded ? "Mai puțin" : "Mai mult"}</button>}</div>
    <time dateTime={row.createdAt}>{dateFormat.format(new Date(row.createdAt))}</time>
  </article>;
}
