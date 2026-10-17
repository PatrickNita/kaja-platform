import { activityData } from "./actions";

const brands = [
  { key: "kaja", label: "KAJA" },
  { key: "hexenwerk", label: "HEXENWERK" },
  { key: "virginia", label: "LUMEN" },
] as const;
type Brand = (typeof brands)[number]["key"];
type ActivityRows = Awaited<ReturnType<typeof activityData>>;

function hrefFor(row: ActivityRows[number]) {
  const { event } = row;
  const brand = event.brand as Brand;
  if (event.entityType === "update") return `/?brand=${brand}&view=activity#entry-update-${event.entityId}`;
  if (event.entityType === "task") return `/?brand=${row.taskCompleted ? "all" : brand}&view=tasks&tasks=${row.taskCompleted ? "history" : "all"}#entry-task-${event.entityId}`;
  if (event.entityType === "attachment") return `/?brand=${brand}&view=uploads#attachment-${event.entityId}`;
  return `/?brand=${brand}&view=${event.entityType}${event.entityType === "catalogue" ? `&catalogue=${event.catalogueGroup || "live"}` : ""}#entry-${event.entityType}-${event.entityId}`;
}

function textFor(event: ActivityRows[number]["event"]) {
  return event.action === "commented" && event.title?.trim() ? `a comentat la „${event.title}”` : event.summary;
}

export function ActivityPanel({ initialRows }: { initialRows: ActivityRows }) {
  return <aside className="panel activity-panel">
    <div className="activity-header">
      <h2>ACTIVITATE</h2>
    </div>
    <div id="activity-list" className="activity">
      {initialRows.map((row) => {
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
