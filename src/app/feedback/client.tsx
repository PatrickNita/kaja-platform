"use client";
import { ProductTable } from "../product-table";
import { FilterLink } from "../filter-link";
import { useSearchParams } from "next/navigation";
import { ProductListSort } from "../product-list-controls";
import { normalizeProductSort, sortProductList } from "../../lib/product-list-sort";
import { markSeen } from "../member-seen";
import { useEffect, useRef, useState } from "react";
import { feedbackPath, feedbackBrands, type FeedbackBrand, type FeedbackProduct, type MemberFeedbackProduct, type ProductComment } from "../../lib/feedback-model";
import { ConfirmDialog } from "../b2b/ui";
import { FeedbackMessageDialog } from "./message-dialog";
import { NavigationIcon } from "../navigation-icon";

export function FeedbackAdmin({ products, brand, origin }: { products: MemberFeedbackProduct[]; brand: FeedbackBrand; origin: string }) {
  const [selected, setSelected] = useState<FeedbackProduct | null>(null);
  const params=useSearchParams();
  const sortedProducts=sortProductList(products,normalizeProductSort(params.get("sort")),p=>({name:p.name,id:p.id}));
  const opener = useRef<HTMLButtonElement | null>(null);
  function close() { setSelected(null); requestAnimationFrame(() => opener.current?.focus()); }
  return <>
    <nav className="catalogue-submenu filter-nav brand-filter-nav" aria-label="Filtrează după brand">{feedbackBrands.map((b) => <FilterLink key={b.key} href={`/feedback?brand=${b.key}`} className={brand === b.key ? "active" : undefined}>{b.label}</FilterLink>)}</nav>
    <section className="panel content-section"><div className="panel-head"><h2>Feedback <span className="page-entry-count">({products.length})</span></h2></div><ProductListSort /><ProductTable label="Lista produselor pentru feedback" variant="product-table--feedback" columns={["Produs","Gust","Brand","Comentarii"]}><div className="items feedback-product-list">{sortedProducts.map((p) => <div key={p.id} role="row"><button type="button" aria-haspopup="dialog" aria-label={`Deschide feedback pentru ${p.name}`} className="card-wrap feedback-product product-list-row" onClick={(event) => { opener.current = event.currentTarget; setSelected(p); }}><span className="product-table-product" role="cell"><span className="product-list-symbol"><NavigationIcon name="feedback" /></span><strong className="item-title">{p.name}</strong></span><span className="product-table-flavor product-list-secondary" role="cell">{p.flavor}</span><span className="product-table-brand entry-brand-inline" role="cell">{feedbackBrands.find(b=>b.key===p.brand)?.label ?? p.brand}</span><span className="product-table-count product-list-secondary" role="cell">{p.feedbackCount}</span><span className="product-table-chevron" role="cell"><NavigationIcon name="chevron" /></span></button></div>)}</div></ProductTable>{!products.length && <p className="feedback-secondary">Nu există produse în catalogul activ al acestui brand.</p>}</section>
    {selected && <ProductFeedback key={selected.id} product={selected} origin={origin} close={close} />}
  </>;
}
function ProductFeedback({ product, origin, close }: { product: FeedbackProduct; origin: string; close: () => void }) {
  const [selectedComment, setSelectedComment] = useState<ProductComment | null>(null);
  const commentsRef = useRef<HTMLDivElement>(null);
  const returnPosition = useRef<{id:number; scrollTop:number} | null>(null);
  useEffect(() => {
    if (selectedComment || !returnPosition.current) return;
    const position = returnPosition.current;
    const frame = requestAnimationFrame(() => {
      const list = commentsRef.current;
      list?.querySelector<HTMLButtonElement>(`[data-feedback-id="${position.id}"]`)?.focus({preventScroll:true});
      const dialog = list?.closest("dialog");
      if (dialog) dialog.scrollTop = position.scrollTop;
    });
    return () => cancelAnimationFrame(frame);
  }, [selectedComment]);
  const [comments, setComments] = useState<ProductComment[]>([]);
  const [more, setMore] = useState(false);
  const [seenError, setSeenError] = useState(false), [seenRetry, setSeenRetry] = useState(0);
  const acknowledged = useRef(new Set<number>());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);
  const link = `${origin}${feedbackPath(product)}`;
  useEffect(() => {
    const controller = new AbortController();
    fetch(`/api/feedback/${product.id}`, { signal: controller.signal, cache: "no-store" }).then(async (r) => { const data = await r.json(); if (!r.ok) throw Error(data.error); setComments(data.comments); setMore(data.more); }).catch((e) => { if (!controller.signal.aborted) setError(e.message || "Nu s-au putut încărca mesajele."); }).finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [product.id]);
  useEffect(() => {
    if (selectedComment) return;
    const ids = comments.map(c => c.id).filter(id => !acknowledged.current.has(id));
    if (!ids.length) return;
    let cancelled = false;
    void (async () => {
      for (let start = 0; start < ids.length; start += 50) {
        if (cancelled) return;
        const batch = ids.slice(start, start + 50);
        const ok = await markSeen({ type: "feedback", ids: batch });
        if (ok) batch.forEach(id => acknowledged.current.add(id));
        if (cancelled) return;
        if (!ok) { setSeenError(true); return; }
      }
      setSeenError(false);
    })();
    return () => { cancelled = true; };
  }, [comments, seenRetry, selectedComment]);
  async function next() {
    setLoading(true); setError("");
    try {
      const r = await fetch(`/api/feedback/${product.id}?before=${comments.at(-1)?.id}`, { cache: "no-store" });
      const data = await r.json(); if (!r.ok) throw Error(data.error);
      setComments((old) => [...old, ...data.comments]); setMore(data.more);
    } catch { setError("Nu s-au putut încărca mesajele."); } finally { setLoading(false); }
  }
  if (selectedComment) return <FeedbackMessageDialog message={{...selectedComment, product:product.name, brand:product.brand, flavor:product.flavor}} onClose={() => setSelectedComment(null)} />;
  return <ConfirmDialog title={`${product.name} - ${product.flavor}`} titleContent={<>{product.name} <span className="feedback-secondary">- {product.flavor}</span></>} busy={false} onClose={close} className="feedback-dialog">
    <div className="feedback-qr-panel">
      {/* A same-origin authenticated SVG route keeps QR generation on the server. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img className="feedback-qr" src={`/api/feedback/${product.id}/qr`} width={200} height={200} alt={`Cod QR feedback ${product.name}`} />
      <div className="feedback-actions"><button type="button" className="button ghost" onClick={async () => { try { await navigator.clipboard.writeText(link); setCopied(true); setError(""); } catch { setError("Copierea a eșuat. Selectează și copiază manual linkul de mai jos."); } }}>Copiază linkul</button><a className="button ghost" href={`/api/feedback/${product.id}/qr?download`} download>Descarcă QR</a></div>
      <input className="feedback-link" value={link} readOnly aria-label="Link public feedback" onFocus={(event) => event.currentTarget.select()} />
      {copied && <p role="status" className="b2b-success">Link copiat.</p>}
    </div>
    <h4 className="feedback-comments-title">Comentarii</h4>{seenError && <div className="read-state-error" role="alert">Nu s-au putut marca mesajele drept văzute. <button className="text-button" onClick={() => setSeenRetry(n => n + 1)}>Reîncearcă</button></div>}{error && <p className="b2b-error" role="alert">{error}</p>}
    <div className="feedback-comments" ref={commentsRef}>{comments.map((c) => <button key={c.id} type="button" className="feedback-comment" data-feedback-id={c.id} aria-haspopup="dialog" onClick={event => {returnPosition.current={id:c.id,scrollTop:event.currentTarget.closest("dialog")?.scrollTop ?? 0};setSelectedComment(c);}}><NavigationIcon name="feedback" /><span className="feedback-comment-text">{c.body}</span><time className="feedback-secondary" dateTime={c.createdAt}>{new Intl.DateTimeFormat("ro-RO", { dateStyle: "medium", timeStyle: "short", timeZone: "Europe/Chisinau" }).format(new Date(c.createdAt))}</time><NavigationIcon name="chevron" /></button>)}{!loading && !comments.length && !error && <p className="feedback-secondary">Nu există feedback pentru acest produs.</p>}{loading && <p role="status">Se încarcă…</p>}{more && <button type="button" className="button ghost" disabled={loading} onClick={next}>Mai multe comentarii</button>}</div>
  </ConfirmDialog>;
}
