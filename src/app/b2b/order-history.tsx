"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { usePortalLanguage } from "../public-language";
import { matchesProduct } from "../../lib/public-language";
import { requestError } from "../../lib/b2b/errors";
import { markSeen } from "../member-seen";
import { useSearchParams, useRouter } from "next/navigation";
import {
  canEditOrder,
  money,
  nextStatus,
  statusLabel,
  stockLimit,
  type Order,
  type Product,
  type Status,
} from "../../lib/b2b/model";
import {
  formatOrderDate,
  historyOrders,
  periodParts,
  shortStatus,
} from "../../lib/b2b/presentation";
import { ConfirmDialog, Feedback, request } from "./ui";
import { FilterSelect } from "./filter-select";
const monthOptions = [
  { value: "", label: "Toate lunile" },
  ...Array.from({ length: 12 }, (_, i) => ({
    value: String(i + 1).padStart(2, "0"),
    label: new Intl.DateTimeFormat("ro-RO", {
      month: "long",
      timeZone: "UTC",
    }).format(new Date(Date.UTC(2026, i, 1))),
  })),
];
export function History({
  orders,
  products,
  manager,
  allowEdit,
  mode,
  hideHeading = false,
}: {
  orders: Order[];
  products: Product[];
  manager: boolean;
  allowEdit: boolean;
  mode: "admin" | "portal";
  hideHeading?: boolean;
}) {
  const { language, t } = usePortalLanguage();
  const params = useSearchParams();
  const opener = useRef<HTMLButtonElement | null>(null), history = useRef<HTMLElement | null>(null);
  const router = useRouter();
  const onlyUnread = mode === "admin" && params.get("unread") === "1";
  const requested = mode === "admin" ? Number(params.get("order")) : 0;
  const [readVersions, setReadVersions] = useState<Record<number, number>>({});
  const acknowledge = useCallback((id: number, version: number) => setReadVersions(old => ({ ...old, [id]: Math.max(old[id] ?? 0, version) })), []);
  const isUnread = (o: Order) => o.version > Math.max(o.seen_version ?? 0, readVersions[o.id] ?? 0);
  function closeOrder() {
    setActive(null);
    requestAnimationFrame(() => { if (opener.current?.isConnected) opener.current.focus(); else history.current?.focus(); });
    if (mode === "admin" && params.has("order")) { const url = new URL(window.location.href); url.searchParams.delete("order"); router.replace(url.pathname + url.search, { scroll: false }); }
  }

  const [month, setMonth] = useState(""),
    [year, setYear] = useState(""),
    [active, setActive] = useState<number | null>(requested || null),
    [success, setSuccess] = useState("");
  useEffect(() => { if (mode === "admin") setActive(requested || null); }, [mode, requested]);
  const years = [
    ...new Set([
      ...orders.map((o) => periodParts(o.created_at).year),
      ...(year ? [year] : []),
    ]),
  ]
    .sort()
    .reverse();
  const visible = historyOrders(
      orders,
      mode === "admin" ? month : "",
      mode === "admin" ? year : "",
    ).filter(o => (!onlyUnread || isUnread(o)) && (mode !== "admin" || !params.get("brand") || ["all", "kaja"].includes(params.get("brand")!))),
    order = orders.find((o) => o.id === active);
  return (
    <section ref={history} tabIndex={-1} className="b2b-history" aria-label={t("Istoricul comenzilor")}>
      {!hideHeading && <h2>{t("Istoricul comenzilor")}</h2>}
      {mode === "admin" && (
        <div className="b2b-history-filters">
          <button className={onlyUnread ? "button" : "button ghost"} aria-pressed={onlyUnread} onClick={() => { const url = new URL(window.location.href); if (onlyUnread) url.searchParams.delete("unread"); else url.searchParams.set("unread", "1"); router.replace(url.pathname + url.search, { scroll: false }); }}>Nevăzute</button>
          <FilterSelect
            label="Luna comenzilor"
            value={month}
            options={monthOptions}
            onChange={setMonth}
          />
          <FilterSelect
            label="Anul comenzilor"
            value={year}
            options={[
              { value: "", label: "Toți anii" },
              ...years.map((y) => ({ value: y, label: y })),
            ]}
            onChange={setYear}
          />
          {(month || year) && (
            <button
              className="button ghost"
              onClick={() => {
                setMonth("");
                setYear("");
              }}
            >
              Resetează perioada
            </button>
          )}
        </div>
      )}
      <Feedback success={success} />
      {!visible.length && (
        <p className="meta b2b-muted">
          {orders.length
            ? t("Nu există comenzi pentru perioada selectată.")
            : t("Nu există comenzi încă.")}
        </p>
      )}
      <div className="b2b-order-grid">
        {visible.map((o) => (
          <button
            key={o.id}
            id={"comanda-" + o.id}
            className={"card-wrap b2b-order-card " + o.status}
            onClick={(event) => {
              opener.current = event.currentTarget;
              setActive(o.id);
              setSuccess("");
            }}
            aria-label={
              t("Deschide comanda #") +
              o.id +
              " · " +
              o.location_name +
              " · " +
              formatOrderDate(o.created_at, language) +
              " · " +
              t(shortStatus[o.status])
            }
          >
            <strong>{mode === "portal" ? t(`Comanda #${o.id}`) : o.location_name}{mode === "admin" && isUnread(o) && <span className="unread-dot" aria-label="Nevăzut" />}</strong>
            <time dateTime={o.created_at}>{formatOrderDate(o.created_at, language)}</time>
            <span className={"b2b-status " + o.status}>
              {t(shortStatus[o.status])}
            </span>
          </button>
        ))}
      </div>
      {order && (
        <OrderDialog
          key={order.id}
          order={order}
          products={products}
          mode={mode}
          manager={manager}
          allowEdit={allowEdit}
          onClose={closeOrder}
          onSeen={acknowledge}
          onSaved={(message) => {
            setSuccess(message);
            closeOrder();
          }}
        />
      )}
    </section>
  );
}
function OrderDialog({
  order,
  products,
  mode,
  manager,
  allowEdit,
  onClose,
  onSaved,
  onSeen,
}: {
  order: Order;
  products: Product[];
  mode: "admin" | "portal";
  manager: boolean;
  allowEdit: boolean;
  onClose: () => void;
  onSaved: (message: string) => void;
  onSeen: (id: number, version: number) => void;
}) {
  const { language, t, flavor } = usePortalLanguage();
  const router = useRouter();
  const [statusIntent, setStatusIntent] = useState<{
    version: number;
    target: Status;
  } | null>(null);
  const [step, setStep] = useState<"details" | "edit" | "review" | "status">(
    "details",
  );
  const [seenError, setSeenError] = useState(false), [seenRetry, setSeenRetry] = useState(0);
  useEffect(() => {
    if (mode !== "admin" || step !== "details") return;
    let cancelled = false;
    setSeenError(false);
    void markSeen({ type: "order", id: order.id, version: order.version }).then(ok => {
      if (!cancelled) { setSeenError(!ok); if (ok) onSeen(order.id, order.version); }
    });
    return () => { cancelled = true; };
  }, [mode, step, order.id, order.version, seenRetry, onSeen]);

  const [counts, setCounts] = useState<Record<number, number>>(() =>
    Object.fromEntries(order.items.map((i) => [i.id, i.quantity])),
  );
  const [baseVersion, setBaseVersion] = useState(order.version),
    [ready, setReady] = useState(false),
    [search, setSearch] = useState(""),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const inFlight = useRef(false),
    storageKey = `kaja-b2b-cart:${mode}:${order.location_id}:${order.id}`;
  const editable = allowEdit && canEditOrder(order.status, manager),
    stale = baseVersion !== order.version;
  const selected = products.filter((p) => (counts[p.id] ?? 0) > 0),
    total = selected.reduce((s, p) => s + p.price * counts[p.id], 0),
    units = selected.reduce((s, p) => s + counts[p.id], 0);
  useEffect(() => {
    try {
      const saved = JSON.parse(sessionStorage.getItem(storageKey) || "null");
      if (
        saved?.version === order.version &&
        saved.counts &&
        typeof saved.counts === "object"
      )
        setCounts(
          Object.fromEntries(
            products.map((p) => [
              p.id,
              Number.isInteger(saved.counts[p.id])
                ? Math.max(
                    0,
                    Math.min(
                      saved.counts[p.id],
                      stockLimit(
                        p,
                        order.items.find((i) => i.id === p.id)?.quantity ?? 0,
                      ),
                    ),
                  )
                : 0,
            ]),
          ),
        );
    } catch {}
    setReady(true);
  }, [storageKey, order.version, products, order.items]);
  useEffect(() => {
    if (ready && !inFlight.current) {
      try {
        sessionStorage.setItem(
          storageKey,
          JSON.stringify({ version: baseVersion, counts }),
        );
      } catch {}
    }
  }, [ready, counts, baseVersion, storageKey]);
  function change(product: Product, delta: number) {
    setCounts((c) => ({
      ...c,
      [product.id]: Math.max(
        0,
        Math.min(
          (c[product.id] ?? 0) + delta,
          stockLimit(
            product,
            order.items.find((i) => i.id === product.id)?.quantity ?? 0,
          ),
        ),
      ),
    }));
  }
  function quantities(p: Product) {
    return (
      <div className="b2b-edit-quantity">
        <div className="b2b-quantity">
          <button
            type="button"
            aria-label={t("Scade " + p.name)}
            disabled={busy || !ready || !editable || !(counts[p.id] > 0)}
            onClick={() => change(p, -1)}
          >
            −
          </button>
          <output aria-label={t("Cantitate " + p.name)} aria-live="polite">
            {counts[p.id] ?? 0}
          </output>
          <button
            type="button"
            aria-label={t("Adaugă " + p.name)}
            disabled={
              busy ||
              !ready ||
              !editable ||
              (counts[p.id] ?? 0) >=
                stockLimit(
                  p,
                  order.items.find((i) => i.id === p.id)?.quantity ?? 0,
                )
            }
            onClick={() => change(p, 1)}
          >
            +
          </button>
        </div>
        <strong className="b2b-line-price">{money((counts[p.id] ?? 0) * p.price)}</strong>
      </div>
    );
  }
  async function save() {
    if (inFlight.current) return;
    inFlight.current = true;
    setBusy(true);
    setError("");
    try {
      await request({
        mode,
        operation: "saveOrder",
        locationId: order.location_id,
        orderId: order.id,
        version: baseVersion,
        quantities: selected.map((p) => ({
          productId: p.id,
          quantity: counts[p.id],
        })),
      });
      try {
        sessionStorage.removeItem(storageKey);
      } catch {}
      router.refresh();
      onSaved("Comanda #" + order.id + " a fost actualizată.");
    } catch (e) {
      setError(requestError(e, "Salvarea nu a reușit."));
      router.refresh();
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  }
  const targetStatus =
    step === "status"
      ? (statusIntent?.target ?? null)
      : nextStatus(order.status);
  const statusStale =
    step === "status" && statusIntent?.version !== order.version;
  async function transition() {
    if (!targetStatus || statusStale || inFlight.current) return;
    inFlight.current = true;
    setBusy(true);
    setError("");
    try {
      await request({
        mode: "admin",
        operation: "status",
        orderId: order.id,
        version: statusIntent?.version,
        status: targetStatus,
      });
      router.refresh();
      onSaved("Comanda #" + order.id + " · " + statusLabel[targetStatus]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Actualizarea nu a reușit.");
      router.refresh();
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  }
  const editing = step === "edit" || step === "review";
  const title =
    step === "details"
      ? t(`Comanda #${order.id}`)
      : step === "status"
        ? targetStatus === "paid"
          ? "Confirmă achitarea"
          : t("Confirmă comanda")
        : step === "review"
          ? t("Verifică modificările")
          : t(`Modifică comanda #${order.id}`);
  const shownLines =
    step === "details"
      ? order.items
      : selected.map((p) => ({ ...p, quantity: counts[p.id] }));
  return (
    <ConfirmDialog
      title={title}
      subtitle={
        <time dateTime={order.created_at}>
          {formatOrderDate(order.created_at, language)}
        </time>
      }
      busy={busy}
      onClose={onClose}
      className="b2b-checkout b2b-order-dialog"
    >
      {seenError && <div className="read-state-error" role="alert">Nu s-a putut marca drept văzută. <button className="text-button" onClick={() => setSeenRetry(n => n + 1)}>Reîncearcă</button></div>}
      <div className="b2b-checkout-destination">
        <p className="b2b-checkout-location">
          <strong>{order.location_name}</strong> ·{" "}
          {order.location_snapshot.address}
        </p>
        <p className="b2b-order-contact">
          {order.location_snapshot.contact} · {order.location_snapshot.phone}
        </p>
      </div>
      {step === "details" && (
        <div className="b2b-order-metadata">
          {order.author !== "Local" && <span>{t("Plasată de ")}{order.author}</span>}
          <span className={"b2b-status " + order.status}>
            {t(shortStatus[order.status])}
          </span>
        </div>
      )}
      {step === "status" ? (
        <div className="b2b-status-confirm">
          <p>
            {targetStatus === "paid"
              ? `Confirmi achitarea comenzii de ${money(order.total)}? Se acordă ${money(Math.round(order.total * 0.05))} cashback localului. Comanda va fi blocată pentru modificări.`
              : "După confirmare, localul nu mai poate modifica această comandă. Patrick și Ionut o pot modifica până la achitare."}
          </p>
          {statusStale && (
            <p className="b2b-error" role="alert">{t("Comanda a fost actualizată între timp. Revino la detalii pentru a verifica starea curentă.")}</p>
          )}
          <Feedback error={error} />
          <div className="b2b-actions">
            <button
              className="button ghost"
              disabled={busy}
              onClick={() => {
                setStep("details");
                setError("");
              }}
            >{t("Înapoi")}</button>
            <button
              className="button"
              disabled={busy || !targetStatus || statusStale}
              onClick={transition}
            >
              {busy
                ? "Se actualizează…"
                : targetStatus === "paid"
                  ? "Confirmă achitarea"
                  : t("Confirmă comanda")}
            </button>
          </div>
        </div>
      ) : (
        <>
          <div className="b2b-order-section-heading">
            <h4 className="b2b-checkout-label">
              {step === "details"
                ? t("Produse și detalii")
                : step === "edit"
                  ? t("Catalog")
                  : t("Produse selectate")}
            </h4>
          </div>
          {step === "edit" && (
            <input
              type="search"
              aria-label={t("Caută produse pentru comandă")}
              placeholder={t("Caută după denumire sau gust…")}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          )}
          <ul
            className="b2b-review b2b-checkout-list"
            aria-label={
              step === "edit"
                ? t("Catalog pentru modificare")
                : t("Produsele comenzii")
            }
          >
            {(step === "edit"
              ? products.filter((p) =>
                  matchesProduct(p, search),
                )
              : shownLines
            ).map((p) => (
              <li key={p.id} className={step === "edit" ? "b2b-edit-row" : undefined}>
                <span className="b2b-checkout-product">
                  <strong>{p.name}</strong>
                  <span className="b2b-checkout-flavor"> · {flavor(p.flavor)}</span>
                </span>
                {step === "edit" ? (
                  quantities(p)
                ) : (
                  <span className="b2b-checkout-amount">
                    <span className="b2b-line-units">{"quantity" in p ? Number(p.quantity) : counts[p.id]} {t("buc.")}</span>
                    <strong className="b2b-line-price">
                      {money(
                        p.price *
                          ("quantity" in p ? Number(p.quantity) : counts[p.id]),
                      )}
                    </strong>
                  </span>
                )}
              </li>
            ))}
          </ul>
          {step === "edit" &&
            !products.some((p) =>
              matchesProduct(p, search),
            ) && (
              <p role="status" className="b2b-muted">{t("Nu există produse potrivite.")}</p>
            )}
          {step === "edit" && !selected.length && (
            <p role="status" className="b2b-muted">{t("Adaugă cel puțin un produs pentru a salva comanda.")}</p>
          )}
          <div className="b2b-checkout-footer">
            <p className="b2b-checkout-total">
              <span>{t("Total")}</span>
              <span className="b2b-checkout-amount">
                {step === "details"
                  ? order.items.reduce((s, i) => s + i.quantity, 0)
                  : units}{" "}{t("buc. ·")}{" "}
                <strong>
                  {money(step === "details" ? order.total : total)}
                </strong>
              </span>
            </p>
            {step === "details" && order.status === "paid" && (
              <p className="b2b-cashback">{t("Cashback acordat:")} {money(order.cashback)}
              </p>
            )}
            {editing && (!editable || stale) && (
              <div role="alert" className="b2b-error">{t("Comanda a fost actualizată între timp. Selecția ta este păstrată.")}{" "}
                <button
                  className="button ghost"
                  onClick={() => {
                    setCounts(
                      Object.fromEntries(
                        order.items.map((i) => [i.id, i.quantity]),
                      ),
                    );
                    setBaseVersion(order.version);
                    setStep("details");
                    setError("");
                  }}
                >{t("Reîncarcă detaliile")}</button>
              </div>
            )}
            <Feedback error={error} />
            {step === "details" && (
              <div className="b2b-order-dialog-actions">
                {editable && (
                  <button
                    className="button ghost"
                    onClick={() => setStep("edit")}
                  >{t("Modifică comanda")}</button>
                )}
                {manager && targetStatus && (
                  <button
                    className="button"
                    onClick={() => {
                      setStatusIntent({
                        version: order.version,
                        target: targetStatus,
                      });
                      setStep("status");
                      setError("");
                    }}
                  >
                    {targetStatus === "paid"
                      ? "Marchează ca achitată"
                      : t("Confirmă comanda")}
                  </button>
                )}
              </div>
            )}
            {step === "edit" && (
              <button
                className="button"
                disabled={!ready || !selected.length || !editable || stale}
                onClick={() => {
                  setError("");
                  setStep("review");
                }}
              >{t("Verifică modificările")}</button>
            )}
            {step === "review" && (
              <>
                <button
                  className="button ghost"
                  disabled={busy}
                  onClick={() => setStep("edit")}
                >{t("Înapoi la modificare")}</button>
                <button
                  className="button"
                  disabled={busy || !selected.length || !editable || stale}
                  onClick={save}
                >
                  {busy ? t("Se salvează…") : t("Salvează modificările")}
                </button>
              </>
            )}
          </div>
        </>
      )}
    </ConfirmDialog>
  );
}
