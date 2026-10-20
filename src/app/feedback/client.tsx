"use client";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { feedbackBrands, type FeedbackBrand, type FeedbackProduct, type ProductComment } from "../../lib/feedback-model";
import { ConfirmDialog } from "../b2b/ui";

export function FeedbackAdmin({ products, brand, origin }: { products: FeedbackProduct[]; brand: FeedbackBrand; origin: string }) {
  const [selected, setSelected] = useState<FeedbackProduct | null>(null);
  const opener = useRef<HTMLButtonElement | null>(null);
  function close() { setSelected(null); requestAnimationFrame(() => opener.current?.focus()); }
  return <>
    <nav className="catalogue-submenu filter-nav brand-filter-nav" aria-label="Filtrează după brand">{feedbackBrands.map((b) => <Link key={b.key} href={`/feedback?brand=${b.key}`} className={brand === b.key ? "active" : undefined}>{b.label}</Link>)}</nav>
    <section className="panel content-section"><div className="panel-head"><h2>Feedback <span className="page-entry-count">({products.length})</span></h2></div><div className="items card-grid">{products.map((p) => <button key={p.id} type="button" className="card-wrap feedback-product" onClick={(event) => { opener.current = event.currentTarget; setSelected(p); }}><span className="item-title">{p.name} <span className="feedback-secondary">- {p.flavor}</span></span></button>)}</div>{!products.length && <p className="feedback-secondary">Nu există produse în catalogul activ al acestui brand.</p>}</section>
    {selected && <ProductFeedback key={selected.id} product={selected} origin={origin} close={close} />}
  </>;
}
function ProductFeedback({ product, origin, close }: { product: FeedbackProduct; origin: string; close: () => void }) {
  const [comments, setComments] = useState<ProductComment[]>([]);
  const [more, setMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);
  const link = `${origin}/feedback/${product.id}`;
  useEffect(() => {
    const controller = new AbortController();
    fetch(`/api/feedback/${product.id}`, { signal: controller.signal, cache: "no-store" }).then(async (r) => { const data = await r.json(); if (!r.ok) throw Error(data.error); setComments(data.comments); setMore(data.more); }).catch((e) => { if (!controller.signal.aborted) setError(e.message || "Nu s-au putut încărca mesajele."); }).finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [product.id]);
  async function next() {
    setLoading(true); setError("");
    try {
      const r = await fetch(`/api/feedback/${product.id}?before=${comments.at(-1)?.id}`, { cache: "no-store" });
      const data = await r.json(); if (!r.ok) throw Error(data.error);
      setComments((old) => [...old, ...data.comments]); setMore(data.more);
    } catch { setError("Nu s-au putut încărca mesajele."); } finally { setLoading(false); }
  }
  return <ConfirmDialog title={`${product.name} - ${product.flavor}`} busy={false} onClose={close} className="feedback-dialog">
    <div className="feedback-qr-panel">
      {/* A same-origin authenticated SVG route keeps QR generation on the server. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img className="feedback-qr" src={`/api/feedback/${product.id}/qr`} width={200} height={200} alt={`Cod QR feedback ${product.name}`} />
      <div className="feedback-actions"><button type="button" className="button ghost" onClick={async () => { try { await navigator.clipboard.writeText(link); setCopied(true); setError(""); } catch { setError("Copierea a eșuat. Selectează și copiază manual linkul de mai jos."); } }}>Copiază linkul</button><a className="button ghost" href={`/api/feedback/${product.id}/qr?download`} download>Descarcă QR</a></div>
      <input className="feedback-link" value={link} readOnly aria-label="Link public feedback" onFocus={(event) => event.currentTarget.select()} />
      {copied && <p role="status" className="b2b-success">Link copiat.</p>}
    </div>
    <h4>Comentarii</h4>{error && <p className="b2b-error" role="alert">{error}</p>}
    <div className="feedback-comments">{comments.map((c) => <article key={c.id} className="feedback-comment"><time className="feedback-secondary" dateTime={c.createdAt}>{new Intl.DateTimeFormat("ro-RO", { dateStyle: "medium", timeStyle: "short", timeZone: "Europe/Chisinau" }).format(new Date(c.createdAt))}</time><p>{c.body}</p></article>)}{!loading && !comments.length && !error && <p className="feedback-secondary">Nu există feedback pentru acest produs.</p>}{loading && <p role="status">Se încarcă…</p>}{more && <button type="button" className="button ghost" disabled={loading} onClick={next}>Mai multe comentarii</button>}</div>
  </ConfirmDialog>;
}
