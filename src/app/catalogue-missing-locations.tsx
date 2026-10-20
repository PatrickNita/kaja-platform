"use client";
import { useEffect, useId, useRef, useState } from "react";
import type { MissingLocation } from "../lib/catalogue-usage";

export function CatalogueMissingLocations({ itemId }: { itemId: number }) {
  const [active, setActive] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(false);
  const [locations, setLocations] = useState<MissingLocation[] | null>(null);
  const [error, setError] = useState("");
  const controller = useRef<AbortController | null>(null);
  const id = useId();
  useEffect(() => () => controller.current?.abort(), []);
  async function load(ordered: boolean) {
    controller.current?.abort();
    const pending = new AbortController();
    controller.current = pending;
    setLoading(true);
    setError("");
    setLocations(null);
    try {
      const response = await fetch(`/api/catalogue/${itemId}/missing-locations${ordered ? "?ordered=true" : ""}`, { signal: pending.signal, cache: "no-store" });
      const data = await response.json();
      if (!response.ok) {
        if (!pending.signal.aborted) setError(data.error || "Localurile nu au putut fi încărcate.");
        return;
      }
      if (!pending.signal.aborted) setLocations(data.locations);
    } catch {
      if (!pending.signal.aborted) setError("Localurile nu au putut fi încărcate. Verifică conexiunea și încearcă din nou.");
    } finally {
      if (!pending.signal.aborted) setLoading(false);
    }
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
        {locations.length > 0 && <ul className="catalogue-missing-list" aria-label={active ? "Localurile care au comandat" : "Localurile care nu au comandat"} tabIndex={0}>{locations.map((location) => <li key={location.id}><strong>{location.name}</strong><span>{location.address}</span></li>)}</ul>}
      </>}
    </div>}
  </section>;
}
