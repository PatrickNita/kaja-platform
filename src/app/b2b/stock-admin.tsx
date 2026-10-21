"use client";
import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import { stockStatus, stockLabel, type Product } from "../../lib/b2b/model";
import { SearchField } from "../design-primitives";
import { matchesProduct } from "../../lib/public-language";

export function StockAdmin() {
  const [products, setProducts] = useState<Product[]>([]), [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true), [error, setError] = useState("");
  const controller = useRef<AbortController | null>(null);
  const load = useCallback(async () => {
    controller.current?.abort(); const pending = new AbortController(); controller.current = pending;
    setLoading(true); setError("");
    try { const response = await fetch("/api/b2b/stock", { cache:"no-store", signal:pending.signal }); const data = await response.json(); if (!response.ok) throw Error(data.error); if (!pending.signal.aborted) setProducts(data.products); }
    catch (e) { if (!pending.signal.aborted) setError(e instanceof Error ? e.message : "Stocul nu a putut fi încărcat."); }
    finally { if (!pending.signal.aborted) setLoading(false); }
  }, []);
  useEffect(() => { void load(); return () => controller.current?.abort(); }, [load]);
  return <section className="stock-admin" aria-label="Administrare stoc">
    <div className="stock-toolbar"><SearchField aria-label="Caută în stoc" placeholder="Caută produs sau gust…" value={search} onChange={e => setSearch(e.target.value)} /><button className="button ghost" disabled={loading} onClick={() => void load()}>Reîncarcă stocul</button></div>
    <p className="meta stock-legend">În stoc: peste 50 buc. · Stoc limitat: 1–50 buc. · Stoc epuizat: 0 buc. Cantitățile scad automat la plasarea comenzilor.</p>
    {loading && <p role="status" className="meta">Se încarcă stocul…</p>}
    {error && <p role="alert" className="b2b-error">{error}</p>}
    <div className="premium-list">{products.filter(p => matchesProduct(p,search)).map(product => <StockRow key={product.id} product={product} onSaved={value => setProducts(old => old.map(p => p.id === value.id ? value : p))} />)}</div>
    {!loading && !error && !products.filter(p => matchesProduct(p,search)).length && <p className="empty-state">Nu există produse potrivite.</p>}
  </section>;
}
function StockRow({ product, onSaved }: { product: Product; onSaved: (product:Product) => void }) {
  const [base,setBase] = useState(product), [quantity,setQuantity] = useState(String(product.stock ?? 0));
  const [busy,setBusy] = useState(false), [error,setError] = useState(""), [saved,setSaved] = useState(false);
  const [conflict,setConflict] = useState<Product | null>(null);
  const dirty = quantity !== String(base.stock ?? 0);
  useEffect(() => { if (!dirty && !busy) { setBase(product); setQuantity(String(product.stock ?? 0)); } }, [product,dirty,busy]);
  const valid = /^\d+$/.test(quantity) && Number(quantity)<=1000000;
  async function save(event:FormEvent) {
    event.preventDefault(); if (busy || !valid || !dirty) return;
    setBusy(true); setError(""); setSaved(false); setConflict(null);
    try {
      const response = await fetch("/api/b2b/stock", { method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({id:product.id,quantity:Number(quantity),version:base.stockVersion}) });
      const data = await response.json(); if (!response.ok) { if (response.status===409) setConflict(data.product); throw Error(data.error); }
      setBase(data.product); setQuantity(String(data.product.stock)); onSaved(data.product); setSaved(true);
    } catch (e) { setError(e instanceof Error ? e.message : "Stocul nu a putut fi salvat. Încearcă din nou."); }
    finally { setBusy(false); }
  }
  const status = stockStatus(product);
  return <form className="stock-row" onSubmit={save} aria-label={"Stoc " + product.name}>
    <div className="stock-product"><strong>{product.name}</strong><span>{product.flavor}</span></div>
    <span className={`stock-status ${status}`}>{stockLabel[status]}</span>
    <label className="stock-quantity">Bucăți<input type="number" min="0" max="1000000" step="1" inputMode="numeric" value={quantity} disabled={busy} onChange={e => {setQuantity(e.target.value);setSaved(false);}} aria-label={"Stoc pentru " + product.name} /></label>
    <button className="button" disabled={busy || !dirty || !valid || !base.stockVersion}>{busy ? "Se salvează…" : "Salvează"}</button>
    {error && <div className="stock-row-message"><p className="b2b-error" role="alert">{error}</p>{conflict && <button type="button" className="button ghost" onClick={() => {setBase(conflict);setQuantity(String(conflict.stock));onSaved(conflict);setConflict(null);setError("");}}>Preia stocul actual ({conflict.stock} buc.)</button>}</div>}
    {saved && <p className="stock-row-message b2b-success" role="status">Stoc salvat.</p>}
  </form>;
}
