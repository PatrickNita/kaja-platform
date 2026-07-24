"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { activityData } from "./actions";

const brands = [
  { key: "kaja", label: "KAJA" },
  { key: "hexenwerk", label: "HEXENWERK" },
  { key: "virginia", label: "VIRGINIA" },
] as const;
const activityFilters = [{ key: "all", label: "Toate" }, ...brands] as const;

type Brand = (typeof brands)[number]["key"];
type ActivityFilter = (typeof activityFilters)[number]["key"];
type ActivityRows = Awaited<ReturnType<typeof activityData>>;

function isActivityFilter(value: string | null): value is ActivityFilter {
  return activityFilters.some((filter) => filter.key === value);
}

function savedFilterFor(key: string) {
  try {
    return sessionStorage.getItem(key);
  } catch {
    return null;
  }
}

function rememberFilter(key: string, filter: ActivityFilter) {
  try {
    sessionStorage.setItem(key, filter);
  } catch {
    // Filtering still works when browser storage is unavailable.
  }
}

function hrefFor(row: ActivityRows[number]) {
  const { event } = row;
  const brand = event.brand as Brand;
  if (event.entityType === "update") return `/?brand=${brand}&view=updates#entry-update-${event.entityId}`;
  if (event.entityType === "task") return `/?brand=${brand}&view=tasks&tasks=${row.taskCompleted ? "history" : "all"}&taskBrand=${row.taskCompleted ? "all" : brand}#entry-task-${event.entityId}`;
  if (event.entityType === "attachment") return `/?brand=${brand}&view=uploads#attachment-${event.entityId}`;
  return `/?brand=${brand}&view=${event.entityType}${event.entityType === "catalogue" ? `&catalogue=${event.catalogueGroup || "live"}` : ""}#entry-${event.entityType}-${event.entityId}`;
}

function textFor(event: ActivityRows[number]["event"]) {
  return event.action === "commented" && event.title?.trim() ? `a comentat la „${event.title}”` : event.summary;
}

export function ActivityPanel({ initialRows, initialFilter, memberSlug }: { initialRows: ActivityRows; initialFilter: ActivityFilter; memberSlug: string }) {
  const [rows, setRows] = useState(initialRows);
  const [selectedFilter, setSelectedFilter] = useState<ActivityFilter>(initialFilter);
  const [pendingFilter, setPendingFilter] = useState<ActivityFilter | null>(null);
  const [error, setError] = useState("");
  const requestSequence = useRef(0);
  const storageKey = `kaja:activity-filter:${memberSlug}`;

  const selectFilter = useCallback(async (nextFilter: ActivityFilter, persist = true) => {
    const sequence = ++requestSequence.current;
    setPendingFilter(nextFilter);
    setError("");

    try {
      const nextRows = await activityData(nextFilter);
      if (sequence !== requestSequence.current) return;
      setRows(nextRows);
      setSelectedFilter(nextFilter);
      if (persist) rememberFilter(storageKey, nextFilter);
    } catch {
      if (sequence !== requestSequence.current) return;
      setError("Activitatea nu a putut fi încărcată. Încearcă din nou.");
    } finally {
      if (sequence === requestSequence.current) setPendingFilter(null);
    }
  }, [storageKey]);

  useEffect(() => {
    const savedFilter = savedFilterFor(storageKey);
    if (!isActivityFilter(savedFilter)) {
      return;
    }
    if (savedFilter !== initialFilter) void selectFilter(savedFilter, false);
  }, [initialFilter, selectFilter, storageKey]);

  return <aside className="panel activity-panel">
    <div className="activity-header">
      <h2>Activitate</h2>
      <nav className="activity-filters" aria-label="Filtrează activitatea după brand">
        {activityFilters.map((filter) => <button
          key={filter.key}
          type="button"
          className={`${selectedFilter === filter.key ? "active" : ""}${pendingFilter === filter.key ? " pending" : ""}`.trim() || undefined}
          aria-pressed={selectedFilter === filter.key}
          aria-controls="activity-list"
          onClick={() => {
            if (filter.key !== selectedFilter || pendingFilter) void selectFilter(filter.key);
          }}
        >{filter.label}</button>)}
      </nav>
    </div>
    {error && <p className="activity-filter-error" role="alert">{error}</p>}
    <div id="activity-list" className="activity" aria-busy={pendingFilter !== null}>
      {rows.map((row) => {
        const { event, actor } = row;
        const deletion = ["deleted", "comment_deleted", "image_deleted"].includes(event.action);
        const targetExists = "targetExists" in row ? Boolean(row.targetExists) : true;
        const canLink = event.action !== "deleted" && targetExists;
        const content = <>{textFor(event)} <span className="activity-brand">în {brands.find((brand) => brand.key === event.brand)?.label || event.brand.toUpperCase()}</span></>;
        return <div className={`event${deletion ? " event-deleted" : ""}`} key={event.id}>{event.action === "attention_requested" && <span className="activity-attention" aria-hidden="true">⚠️ </span>}<b>{actor}</b> {canLink ? <a className="activity-link" href={hrefFor(row)}>{content}</a> : content}</div>;
      })}
    </div>
  </aside>;
}
