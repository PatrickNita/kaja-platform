"use client";
import { useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { LocationFlow, type LocationPayload } from "./b2b/client";
import { ConfirmDialog } from "./b2b/ui";
import { NavigationIcon } from "./navigation-icon";
import { useEntryDrilldown } from "./merch-grid";
import type { MissingLocation } from "../lib/catalogue-usage";

export function CatalogueMissingLocations({ itemId }: { itemId: number }) {
  const suspend = useEntryDrilldown();
  const [selected, setSelected] = useState<number | null>(null);
  const list = useRef<HTMLUListElement>(null);
  const trigger = useRef<HTMLButtonElement | null>(null);
  const position = useRef({list:0,dialog:0});
  const changed = useRef(false);
  const [active, setActive] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(false);
  const [locations, setLocations] = useState<MissingLocation[] | null>(null);
  const [error, setError] = useState("");
  const controller = useRef<AbortController | null>(null);
  const id = useId();
  useEffect(() => () => controller.current?.abort(), []);
  async function load(ordered: boolean, retain = false) {
    const scroll = list.current?.scrollTop ?? position.current.list;
    controller.current?.abort();
    const pending = new AbortController();
    controller.current = pending;
    setLoading(true);
    setError("");
    if (!retain) setLocations(null);
    try {
      const response = await fetch(`/api/catalogue/${itemId}/missing-locations${ordered ? "?ordered=true" : ""}`, { signal: pending.signal, cache: "no-store" });
      const data = await response.json();
      if (!response.ok) {
        if (!pending.signal.aborted) setError(data.error || "Localurile nu au putut fi încărcate.");
        return;
      }
      if (!pending.signal.aborted) { setLocations(data.locations); if (retain) requestAnimationFrame(() => { if (list.current) list.current.scrollTop = scroll; if (trigger.current && !trigger.current.isConnected) list.current?.focus({preventScroll:true}); }); }
    } catch {
      if (!pending.signal.aborted) setError("Localurile nu au putut fi încărcate. Verifică conexiunea și încearcă din nou.");
    } finally {
      if (!pending.signal.aborted) setLoading(false);
    }
  }
  function closeLocation() {
    setSelected(null); suspend(false);
    if (changed.current && active !== null) { changed.current = false; void load(active, true); }
    requestAnimationFrame(() => { const dialog = list.current?.closest<HTMLElement>(".entry-modal-surface"); if (dialog) dialog.scrollTop = position.current.dialog; if (list.current) list.current.scrollTop = position.current.list; if (trigger.current?.isConnected) trigger.current.focus({preventScroll:true}); else list.current?.focus({preventScroll:true}); });
  }
  return <section className="catalogue-missing-locations">
    <div className="catalogue-location-buttons" role="group" aria-label="Localuri după comenzile produsului">
      {[true, false].map((ordered) => <button key={String(ordered)} type="button" className={`button ${active === ordered ? "" : "ghost"}`} aria-expanded={active === ordered} aria-pressed={active === ordered} aria-controls={id} onClick={() => {
        controller.current?.abort();
        if (active === ordered) { setActive(null); setLoading(false); }
        else { setActive(ordered); void load(ordered); }
      }}>{ordered ? "Vezi localurile care au comandat" : "Vezi localurile care nu au comandat"}</button>)}
    </div>
    {active !== null && <div id={id} aria-busy={loading}>
      {loading && <p className="meta" role="status">Se încarcă localurile…</p>}
      {error && <><p className="entry-edit-error" role="alert">{error}</p><button className="button ghost" type="button" onClick={() => void load(active)}>Reîncearcă</button></>}
      {locations && <>
        <p className="meta" role="status">{locations.length ? `${active ? "Au comandat" : "Nu au comandat"}: ${locations.length} ${locations.length === 1 ? "local" : "localuri"}` : (active ? "Niciun local nu a comandat acest produs." : "Toate localurile au comandat acest produs.")}</p>
        {locations.length > 0 && <ul ref={list} className="catalogue-missing-list" aria-label={active ? "Localurile care au comandat" : "Localurile care nu au comandat"} tabIndex={0}>{locations.map((location) => <li key={location.id}><button type="button" aria-haspopup="dialog" aria-label={`Detalii pentru ${location.name}, ${location.address}`} onClick={event => { trigger.current = event.currentTarget; position.current = {list:list.current?.scrollTop ?? 0,dialog:list.current?.closest<HTMLElement>(".entry-modal-surface")?.scrollTop ?? 0}; suspend(true); setSelected(location.id); }}><strong title={location.name}>{location.name}</strong><span title={location.address}>{location.address}</span><NavigationIcon name="chevron" /></button></li>)}</ul>}
      </>}
    </div>}
    {selected !== null && createPortal(<CatalogueLocation key={selected} id={selected} onClose={closeLocation} onChanged={() => {changed.current=true;}} />, document.body)}
  </section>;
}

function CatalogueLocation({ id, onClose, onChanged }: { id: number; onClose: () => void; onChanged: () => void }) {
  const [data, setData] = useState<LocationPayload | null>(null), [error, setError] = useState(""), [retry, setRetry] = useState(0);
  useEffect(() => {
    const pending = new AbortController(); setError("");
    void (async () => {
      try { const response = await fetch(`/api/b2b/locations/${id}`, {cache:"no-store",signal:pending.signal}); const value = await response.json(); if (!response.ok) throw Error(value.error); if (!pending.signal.aborted) setData(value); }
      catch (e) { if (!pending.signal.aborted) setError(e instanceof Error ? e.message : "Detaliile nu au putut fi încărcate."); }
    })();
    return () => pending.abort();
  }, [id,retry]);
  if (data) return <LocationFlow initial={data} onClose={onClose} onChanged={onChanged} />;
  return <ConfirmDialog title="Detalii local" busy={false} onClose={onClose}>{error ? <><p role="alert">{error}</p><button className="button ghost" onClick={() => setRetry(n=>n+1)}>Reîncearcă</button></> : <p className="meta" role="status">Se încarcă detaliile…</p>}</ConfirmDialog>;
}
