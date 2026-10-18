"use client";
import "./b2b.css";
import Image from "next/image";

import {
  useEffect,
  useRef,
  useState,
  type FormEvent,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import {
  stockStatus,
  stockLabel,
  stockLimit,
  canEditOrder,
  canManageOrders,
  money,
  nextStatus,
  statusLabel,
  type B2BData,
  type Location,
  type Order,
  type Product,
} from "../../lib/b2b/model";

function searchKey(text: string) {
  return text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();
}

async function request(body: Record<string, unknown>) {
  const response = await fetch("/api/b2b", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  }).catch(() => {
    throw new Error(
      "Conexiunea a eșuat. Verifică internetul și încearcă din nou.",
    );
  });
  const result = await response.json().catch(() => null);
  if (!response.ok || !result)
    throw new Error(result?.error ?? "Operația nu a reușit. Încearcă din nou.");
  return result;
}
function Feedback({ error, success }: { error?: string; success?: string }) {
  return (
    <>
      {error && (
        <p className="b2b-error" role="alert">
          {error}
        </p>
      )}
      {success && (
        <p className="b2b-success" role="status">
          {success}
        </p>
      )}
    </>
  );
}
function ConfirmDialog({
  children,
  onClose,
  busy,
  title = "Confirmă comanda",
  className = "",
}: {
  className?: string;
  title?: string;
  children: ReactNode;
  onClose: () => void;
  busy: boolean;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    ref.current?.showModal();
    return () => {
      ref.current?.close();
      document.body.style.overflow = previousOverflow;
    };
  }, []);
  return (
    <dialog
      className={`entry-modal-surface b2b-dialog ${className}`}
      ref={ref}
      onCancel={(event) => {
        event.preventDefault();
        if (!busy) onClose();
      }}
    >
      <div className="b2b-dialog-head">
        <h3 className="item-title">{title}</h3>
        <button
          type="button"
          aria-label="Închide dialogul"
          disabled={busy}
          onClick={onClose}
        >
          ×
        </button>
      </div>
      {children}
    </dialog>
  );
}
function LocationDetails({ location }: { location: Location }) {
  return (
    <section
      className="card-wrap b2b-location-details"
      aria-label="Datele localului"
    >
      <h2 className="item-title b2b-location-name">{location.name}</h2>
      <p className="b2b-location-address">{location.address}</p>
      <p className="b2b-location-person">{location.contact}</p>
      <a
        className="b2b-location-phone"
        href={"tel:" + location.phone.replace(/[^+\d]/g, "")}
      >
        {location.phone}
      </a>
      <p className="b2b-cashback">
        CASHBACK: <strong>{money(location.cashback)}</strong>
      </p>
    </section>
  );
}

function LocationForm({
  location,
  onDone,
  modal = false,
}: {
  modal?: boolean;
  location?: Location;
  onDone: () => void;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    const values = Object.fromEntries(new FormData(event.currentTarget));
    setBusy(true);
    setError("");
    try {
      await request({
        mode: "admin",
        operation: location ? "editLocation" : "createLocation",
        locationId: location?.id,
        version: location?.details_version,
        ...values,
      });
      router.refresh();
      onDone();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Operația nu a reușit.");
    } finally {
      setBusy(false);
    }
  }
  const form = (
    <form className="form card-wrap b2b-form" onSubmit={save}>
      {!modal && (
        <h3 className="item-title">
          {location ? "Editează localul" : "Adaugă local"}
        </h3>
      )}
      <label>
        Denumirea locației
        <input
          name="name"
          autoFocus={modal}
          required
          maxLength={160}
          defaultValue={location?.name}
        />
      </label>
      <label>
        Adresa
        <input
          name="address"
          required
          maxLength={500}
          defaultValue={location?.address}
        />
      </label>
      <label>
        Persoana de contact
        <input
          name="contact"
          required
          maxLength={160}
          defaultValue={location?.contact}
        />
      </label>
      <label>
        Numărul de telefon
        <input
          name="phone"
          type="tel"
          required
          minLength={5}
          maxLength={40}
          defaultValue={location?.phone}
        />
      </label>
      <Feedback error={error} />
      <div className="b2b-actions">
        <button className="button" disabled={busy}>
          {busy ? "Se salvează…" : "Salvează localul"}
        </button>
        <button
          className="button ghost"
          type="button"
          disabled={busy}
          onClick={onDone}
        >
          Anulează
        </button>
      </div>
    </form>
  );
  return modal ? (
    <ConfirmDialog
      title="Adaugă local"
      className="b2b-location-modal"
      busy={busy}
      onClose={onDone}
    >
      {form}
    </ConfirmDialog>
  ) : (
    form
  );
}

export function OrderEditor({
  location,
  products,
  mode,
  order,
  onDone,
  onCartChange,
  hideHeading = false,
}: {
  hideHeading?: boolean;
  location: Location;
  products: Product[];
  mode: "admin" | "portal";
  order?: Order;
  onDone: (id: number) => void;
  onCartChange?: (dirty: boolean) => void;
}) {
  const router = useRouter();
  const [counts, setCounts] = useState<Record<number, number>>(() =>
    Object.fromEntries(order?.items.map((i) => [i.id, i.quantity]) ?? []),
  );
  const [productSearch, setProductSearch] = useState("");
  const [ready, setReady] = useState(false);
  const [requestKey, setRequestKey] = useState("");
  const [review, setReview] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const inFlight = useRef(false);
  const storageKey = `kaja-b2b-cart:${mode}:${location.id}:${order?.id ?? "new"}`;
  const selected = products.filter((p) => (counts[p.id] ?? 0) > 0);
  const total = selected.reduce((sum, p) => sum + p.price * counts[p.id], 0);
  const units = selected.reduce((sum, p) => sum + counts[p.id], 0);
  useEffect(() => {
    try {
      const stored = JSON.parse(sessionStorage.getItem(storageKey) || "null");
      if (
        stored &&
        stored.version === (order?.version ?? 0) &&
        typeof stored.counts === "object" &&
        stored.counts !== null
      ) {
        setCounts(
          Object.fromEntries(
            products.map((p) => [
              p.id,
              Number.isInteger(stored.counts[p.id]) &&
              stored.counts[p.id] >= 0 &&
              stored.counts[p.id] <= 10000
                ? Math.min(
                    stored.counts[p.id],
                    stockLimit(
                      p.name,
                      order?.items.find((i) => i.id === p.id)?.quantity ?? 0,
                    ),
                  )
                : 0,
            ]),
          ),
        );
        setRequestKey(
          typeof stored.requestKey === "string"
            ? stored.requestKey
            : crypto.randomUUID(),
        );
      } else setRequestKey(crypto.randomUUID());
    } catch {
      setRequestKey(crypto.randomUUID());
    }
    setReady(true);
  }, [storageKey, order?.version, products]);
  useEffect(() => {
    if (!ready) return;
    try {
      sessionStorage.setItem(
        storageKey,
        JSON.stringify({ counts, requestKey, version: order?.version ?? 0 }),
      );
    } catch {
      /* Storage may be disabled. */
    }
    onCartChange?.(units > 0);
  }, [
    ready,
    counts,
    requestKey,
    storageKey,
    order?.version,
    onCartChange,
    units,
  ]);
  async function submit() {
    if (inFlight.current) return;
    inFlight.current = true;
    setBusy(true);
    setError("");
    try {
      const response = await request({
        mode,
        operation: "saveOrder",
        locationId: location.id,
        orderId: order?.id,
        version: order?.version,
        requestKey,
        quantities: selected.map((p) => ({
          productId: p.id,
          quantity: counts[p.id],
        })),
      });
      try {
        sessionStorage.removeItem(storageKey);
      } catch {}
      setCounts({});
      setRequestKey(crypto.randomUUID());
      setReview(false);
      router.refresh();
      onDone(response.result.id);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Trimiterea nu a reușit.");
    } finally {
      setBusy(false);
      inFlight.current = false;
    }
  }
  return (
    <section
      className="b2b-editor"
      aria-label={order ? "Modifică comanda" : "Comandă nouă"}
    >
      {!hideHeading && (
        <h2>{order ? `Modifică comanda #${order.id}` : "Comandă nouă"}</h2>
      )}
      <input
        className="b2b-product-search"
        type="search"
        aria-label="Caută după denumire sau gust"
        placeholder="Caută după denumire sau gust…"
        value={productSearch}
        onChange={(event) => setProductSearch(event.target.value)}
      />
      {!products.some((p) =>
        searchKey(p.name + " " + p.flavor).includes(searchKey(productSearch)),
      ) && <p role="status">Nu există produse care corespund căutării.</p>}
      <div className="b2b-products">
        {products
          .filter((p) =>
            searchKey(p.name + " " + p.flavor).includes(
              searchKey(productSearch),
            ),
          )
          .map((product) => (
            <article className="card-wrap b2b-product" key={product.id}>
              <div className="b2b-product-info">
                <h3 className="item-title">{product.name}</h3>
                <p className="b2b-product-meta">
                  {product.flavor} · <span>{product.grams}g</span> ·{" "}
                  <span>{money(product.price)}</span>
                </p>
              </div>
              <div className="b2b-product-controls">
                <span className={`b2b-stock ${stockStatus(product.name)}`}>
                  {stockLabel[stockStatus(product.name)]}
                </span>
                <div className="b2b-quantity">
                  <button
                    type="button"
                    aria-label={`Scade ${product.name}`}
                    disabled={!ready || busy || !(counts[product.id] > 0)}
                    onClick={() =>
                      setCounts((c) => ({
                        ...c,
                        [product.id]: Math.max(0, (c[product.id] ?? 0) - 1),
                      }))
                    }
                  >
                    −
                  </button>
                  <output
                    aria-label={`Cantitate ${product.name}`}
                    aria-live="polite"
                  >
                    {counts[product.id] ?? 0}
                  </output>
                  <button
                    type="button"
                    aria-label={`Adaugă ${product.name}`}
                    disabled={
                      !ready ||
                      busy ||
                      (counts[product.id] ?? 0) >=
                        stockLimit(
                          product.name,
                          order?.items.find((i) => i.id === product.id)
                            ?.quantity ?? 0,
                        )
                    }
                    onClick={() =>
                      setCounts((c) => ({
                        ...c,
                        [product.id]: (c[product.id] ?? 0) + 1,
                      }))
                    }
                  >
                    +
                  </button>
                </div>
              </div>
            </article>
          ))}
      </div>
      <div className="b2b-cart-bar">
        <div>
          <strong>
            {units} buc. · {money(total)}
          </strong>
          <span>{location.name}</span>
        </div>
        <button
          className="button"
          disabled={!ready || busy || !units}
          onClick={() => {
            setError("");
            setReview(true);
          }}
        >
          Verifică {order ? "modificările" : "comanda"}
        </button>
      </div>
      <Feedback error={!review ? error : ""} />
      {review && (
        <ConfirmDialog
          className="b2b-checkout"
          busy={busy}
          onClose={() => setReview(false)}
        >
          <div className="b2b-checkout-destination">
            <span className="b2b-checkout-label">Local destinatar</span>
            <p className="b2b-checkout-location">
              <strong>{location.name}</strong>
              <span aria-hidden="true"> · </span>
              {order ? order.location_snapshot.address : location.address}
            </p>
          </div>
          <h4 className="b2b-checkout-label b2b-checkout-products-title">
            Produse selectate
          </h4>
          <ul
            className="b2b-review b2b-checkout-list"
            aria-label="Produsele comenzii"
          >
            {selected.map((p) => (
              <li key={p.id}>
                <span className="b2b-checkout-product">
                  <strong>{p.name}</strong>
                  <span className="b2b-checkout-flavor"> · {p.flavor}</span>
                </span>
                <span className="b2b-checkout-amount">
                  {counts[p.id]} buc. ·{" "}
                  <strong>{money(p.price * counts[p.id])}</strong>
                </span>
              </li>
            ))}
          </ul>
          <div className="b2b-checkout-footer">
            <p className="b2b-checkout-total">
              <span>Total</span>
              <span className="b2b-checkout-amount">
                {units} buc. · <strong>{money(total)}</strong>
              </span>
            </p>
            <Feedback error={error} />
            <button className="button" disabled={busy} onClick={submit}>
              {busy
                ? "Se trimite…"
                : order
                  ? "Salvează modificările"
                  : "Plasează comanda"}
            </button>
          </div>
        </ConfirmDialog>
      )}
    </section>
  );
}

function History({
  orders,
  manager,
  allowEdit,
  onEdit,
  hideHeading = false,
}: {
  hideHeading?: boolean;
  orders: Order[];
  manager: boolean;
  allowEdit: boolean;
  onEdit: (order: Order) => void;
}) {
  const router = useRouter();
  const [pending, setPending] = useState<number | null>(null);
  const [error, setError] = useState("");
  async function transition(order: Order) {
    const status = nextStatus(order.status);
    if (!status || pending !== null) return;
    const question =
      status === "paid"
        ? `Confirmi că această comandă #${order.id}, de ${money(order.total)}, este achitată? Se acordă ${money(Math.round(order.total * 0.05))} cashback, iar comanda se blochează definitiv.`
        : `Confirmi comanda #${order.id} pentru ${order.location_name}? Localul nu o va mai putea modifica.`;
    if (!window.confirm(question)) return;
    setPending(order.id);
    setError("");
    try {
      await request({
        mode: "admin",
        operation: "status",
        orderId: order.id,
        version: order.version,
        status,
      });
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Operația nu a reușit.");
    } finally {
      setPending(null);
    }
  }
  return (
    <section className="b2b-history" aria-label="Istoricul comenzilor">
      {!hideHeading && <h2>Istoricul comenzilor</h2>}
      <Feedback error={error} />
      {orders.length === 0 && (
        <p className="meta b2b-muted">Nu există comenzi încă.</p>
      )}
      {orders.map((order) => (
        <article
          className="card-wrap b2b-order"
          id={`comanda-${order.id}`}
          key={order.id}
        >
          <div className="b2b-order-heading">
            <h3>
              Comanda #{order.id} · {order.location_name}
            </h3>
            <span className={`status b2b-status ${order.status}`}>
              {statusLabel[order.status]}
            </span>
          </div>
          <p className="b2b-muted">
            {new Intl.DateTimeFormat("ro-RO", {
              dateStyle: "medium",
              timeStyle: "short",
              timeZone: "Europe/Chisinau",
            }).format(new Date(order.created_at))}{" "}
            · Plasată de {order.author}
          </p>
          <details>
            <summary>Produse și detalii · {money(order.total)}</summary>
            <p>
              {order.location_snapshot.address}
              <br />
              {order.location_snapshot.contact} ·{" "}
              {order.location_snapshot.phone}
            </p>
            <ul className="b2b-review">
              {order.items.map((item) => (
                <li key={item.id}>
                  <span>
                    {item.name} · {item.flavor} · {item.quantity} × {item.grams}{" "}
                    g
                  </span>
                  <strong>{money(item.price * item.quantity)}</strong>
                </li>
              ))}
            </ul>
          </details>
          {order.status === "paid" && (
            <p className="b2b-cashback">
              Cashback acordat: {money(order.cashback)}
            </p>
          )}
          <div className="b2b-actions">
            {allowEdit && canEditOrder(order.status, manager) && (
              <button className="button ghost" onClick={() => onEdit(order)}>
                Modifică comanda
              </button>
            )}
            {manager && nextStatus(order.status) && (
              <button
                className="button"
                disabled={pending !== null}
                onClick={() => transition(order)}
              >
                {pending === order.id
                  ? "Se actualizează…"
                  : order.status === "placed"
                    ? "Confirmă comanda"
                    : "Marchează achitată"}
              </button>
            )}
          </div>
        </article>
      ))}
    </section>
  );
}

export function B2BPortal({ data }: { data: B2BData }) {
  const [view, setView] = useState<"order" | "history">("order");
  const [editing, setEditing] = useState<Order | null>(null);
  const [success, setSuccess] = useState("");
  const location = data.locations[0];
  const currentEdit = editing
    ? data.orders.find((o) => o.id === editing.id)
    : null;
  return (
    <main className="b2b-portal">
      <header className="b2b-portal-header">
        <Image
          className="logo"
          src="/kaja-logo.png"
          alt="KAJA"
          width={1024}
          height={240}
          priority
        />
      </header>
      <div className="b2b-portal-overview">
        <LocationDetails location={location} />
        <nav className="b2b-portal-navigation" aria-label="Navigare comenzi">
          <button
            className={view === "order" ? "button" : "button ghost"}
            aria-pressed={view === "order"}
            onClick={() => {
              setView("order");
              setEditing(null);
              setSuccess("");
            }}
          >
            Comandă nouă
          </button>
          <button
            className={view === "history" ? "button" : "button ghost"}
            aria-pressed={view === "history"}
            onClick={() => {
              setView("history");
              setSuccess("");
            }}
          >
            Istoric comenzi
          </button>
        </nav>
      </div>
      <Feedback success={success} />
      {view === "order" && editing && (
        <button
          className="button ghost"
          onClick={() => {
            setEditing(null);
            setSuccess("");
          }}
        >
          Înapoi la comandă nouă
        </button>
      )}
      {view === "order" && (
        <div id="formular-comanda">
          {currentEdit && !canEditOrder(currentEdit.status, false) ? (
            <p role="status">
              Comanda a fost confirmată și nu mai poate fi modificată.{" "}
              <button className="button ghost" onClick={() => setEditing(null)}>
                Comandă nouă
              </button>
            </p>
          ) : (
            <OrderEditor
              key={`${location.id}:${editing?.id ?? "new"}:${currentEdit?.version ?? 0}`}
              hideHeading
              mode="portal"
              location={location}
              products={data.products}
              order={currentEdit ?? undefined}
              onDone={(id) => {
                setEditing(null);
                setSuccess(
                  `Comanda #${id} a fost ${editing ? "actualizată" : "plasată"}.`,
                );
              }}
            />
          )}
        </div>
      )}
      {view === "history" && (
        <div id="istoric-comenzi">
          <History
            hideHeading
            orders={data.orders}
            manager={false}
            allowEdit={true}
            onEdit={(order) => {
              setView("order");
              setEditing(order);
              setSuccess("");
              document
                .getElementById("formular-comanda")
                ?.scrollIntoView({ behavior: "smooth" });
            }}
          />
        </div>
      )}
    </main>
  );
}

function LocationActions({
  name,
  actions,
}: {
  name: string;
  actions: { label: string; run: () => void; disabled?: boolean }[];
}) {
  const trigger = useRef<HTMLButtonElement>(null);
  const menu = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState<{
    top: number;
    left: number;
  } | null>(null);
  function close() {
    setPosition(null);
    trigger.current?.focus();
  }
  useEffect(() => {
    if (!position) return;
    menu.current
      ?.querySelector<HTMLButtonElement>("button:not(:disabled)")
      ?.focus();
    const outside = (e: PointerEvent) => {
      if (
        !menu.current?.contains(e.target as Node) &&
        !trigger.current?.contains(e.target as Node)
      )
        setPosition(null);
    };
    const dismiss = () => setPosition(null);
    document.addEventListener("pointerdown", outside);
    const scroll = (event: Event) => {
      if (
        !(event.target instanceof Node) ||
        !menu.current?.contains(event.target)
      )
        dismiss();
    };
    window.addEventListener("scroll", scroll, true);
    window.addEventListener("resize", dismiss);
    return () => {
      document.removeEventListener("pointerdown", outside);
      window.removeEventListener("resize", dismiss);
      window.removeEventListener("scroll", scroll, true);
    };
  }, [position]);
  return (
    <>
      <button
        ref={trigger}
        className="button ghost b2b-more"
        aria-label={"Acțiuni pentru " + name}
        aria-haspopup="menu"
        aria-expanded={Boolean(position)}
        onClick={() => {
          if (position) {
            close();
            return;
          }
          const rect = trigger.current!.getBoundingClientRect();
          const height = actions.length * 44 + 18;
          setPosition({
            left: Math.max(
              8,
              Math.min(rect.right - 240, window.innerWidth - 248),
            ),
            top: Math.max(
              8,
              rect.bottom + height + 8 <= window.innerHeight
                ? rect.bottom + 6
                : rect.top - height - 6,
            ),
          });
        }}
      >
        ⋯
      </button>
      {position &&
        createPortal(
          <div
            ref={menu}
            className="b2b-action-menu"
            role="menu"
            aria-label={"Acțiuni pentru " + name}
            style={{ top: position.top, left: position.left }}
            onKeyDown={(e) => {
              const buttons = [
                ...menu.current!.querySelectorAll<HTMLButtonElement>(
                  "button:not(:disabled)",
                ),
              ];
              const index = buttons.indexOf(
                document.activeElement as HTMLButtonElement,
              );
              if (e.key === "Escape") {
                e.preventDefault();
                e.stopPropagation();
                close();
              }
              if (e.key === "Tab") {
                e.preventDefault();
                close();
              }
              if (["ArrowDown", "ArrowUp", "Home", "End"].includes(e.key)) {
                e.preventDefault();
                const next =
                  e.key === "Home"
                    ? 0
                    : e.key === "End"
                      ? buttons.length - 1
                      : (index +
                          (e.key === "ArrowDown" ? 1 : -1) +
                          buttons.length) %
                        buttons.length;
                buttons[next]?.focus();
              }
            }}
          >
            {actions.map((action) => (
              <button
                role="menuitem"
                key={action.label}
                disabled={action.disabled}
                onClick={() => {
                  close();
                  action.run();
                }}
              >
                {action.label}
              </button>
            ))}
          </div>,
          document.body,
        )}
    </>
  );
}

function LocationFilter({
  locations,
  value,
  onChange,
}: {
  locations: Location[];
  value: number | null;
  onChange: (id: number | null) => void;
}) {
  const root = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [active, setActive] = useState(0);
  const normalize = (text: string) =>
    text
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase();
  const options = [{ id: null, name: "Toate localurile" }, ...locations].filter(
    (l) => normalize(l.name).includes(normalize(search.trim())),
  );
  useEffect(() => {
    if (!open) return;
    input.current?.focus();
    const close = (event: PointerEvent) => {
      if (!root.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", close);
    return () => document.removeEventListener("pointerdown", close);
  }, [open]);
  useEffect(() => {
    if (open)
      root.current
        ?.querySelector(`#b2b-option-${active}`)
        ?.scrollIntoView({ block: "nearest" });
  }, [active, open]);
  function choose(id: number | null) {
    onChange(id);
    setOpen(false);
    root.current?.querySelector<HTMLButtonElement>("button")?.focus();
  }
  return (
    <div className="b2b-location-select" ref={root}>
      <button
        className="button ghost b2b-filter-trigger"
        aria-expanded={open}
        aria-haspopup="listbox"
        onClick={() => {
          setOpen(!open);
          setSearch("");
          setActive(0);
        }}
      >
        {locations.find((l) => l.id === value)?.name ?? "Toate localurile"}
        <span aria-hidden="true">⌄</span>
      </button>
      {open && (
        <div className="b2b-filter-popup">
          <input
            ref={input}
            role="combobox"
            aria-label="Caută local"
            aria-autocomplete="list"
            aria-expanded={true}
            aria-controls="b2b-location-options"
            aria-activedescendant={
              options[active] ? "b2b-option-" + active : undefined
            }
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setActive(0);
            }}
            onKeyDown={(e) => {
              if (e.key === "ArrowDown" || e.key === "ArrowUp") {
                e.preventDefault();
                setActive((i) =>
                  options.length
                    ? (i + (e.key === "ArrowDown" ? 1 : -1) + options.length) %
                      options.length
                    : 0,
                );
              }
              if (e.key === "Enter") {
                e.preventDefault();
                if (options[active]) choose(options[active].id);
              }
              if (e.key === "Escape") {
                e.preventDefault();
                setOpen(false);
                root.current
                  ?.querySelector<HTMLButtonElement>("button")
                  ?.focus();
              }
              if (e.key === "Tab") setOpen(false);
            }}
            placeholder="Caută local…"
          />
          <div role="listbox" id="b2b-location-options" aria-label="Localuri">
            {options.map((l, i) => (
              <button
                type="button"
                role="option"
                tabIndex={-1}
                id={"b2b-option-" + i}
                aria-selected={l.id === value}
                className={i === active ? "active" : ""}
                key={l.id ?? "all"}
                onMouseEnter={() => setActive(i)}
                onClick={() => choose(l.id)}
              >
                {l.name}
              </button>
            ))}
          </div>
          {!options.length && (
            <p className="meta" role="status">
              Nu există localuri potrivite.
            </p>
          )}
        </div>
      )}
    </div>
  );
}

export function B2BAdmin({
  data,
  memberSlug,
  initialView = "locations",
}: {
  data: B2BData;
  memberSlug: string;
  initialView?: "locations" | "history";
}) {
  const router = useRouter();
  const manager = canManageOrders(memberSlug);
  const [view, setView] = useState(initialView);
  const [locationSearch, setLocationSearch] = useState("");
  const [linkLocation, setLinkLocation] = useState<number | null>(null);
  const [historyLocation, setHistoryLocation] = useState<number | null>(null);
  useEffect(() => {
    const sync = () =>
      setView(
        new URLSearchParams(window.location.search).get("tab") === "history"
          ? "history"
          : "locations",
      );
    window.addEventListener("popstate", sync);
    return () => window.removeEventListener("popstate", sync);
  }, []);
  function switchView(next: "locations" | "history") {
    setView(next);
    const url = new URL(window.location.href);
    url.searchParams.set("tab", next);
    window.history.pushState(null, "", url);
  }

  const [origin, setOrigin] = useState("");
  useEffect(() => setOrigin(window.location.origin), []);
  const [locationForm, setLocationForm] = useState<Location | "new" | null>(
    null,
  );
  const [selected, setSelected] = useState<number | null>(null);
  const [editing, setEditing] = useState<Order | null>(null);
  const [showOrder, setShowOrder] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const location = data.locations.find((l) => l.id === selected);
  const matchingLocations = data.locations.filter((local) =>
    searchKey(local.name).includes(searchKey(locationSearch)),
  );
  const visibleLink = data.locations.find((l) => l.id === linkLocation);
  const editOrder = editing
    ? data.orders.find((o) => o.id === editing.id)
    : undefined;
  async function rotate(local: Location) {
    if (!window.confirm(`Generezi un link nou pentru ${local.name}?`)) return;
    if (
      !window.confirm(
        "Linkul vechi și toate sesiunile deschise cu el vor expira imediat. Confirmi definitiv regenerarea?",
      )
    )
      return;
    setBusy(true);
    setError("");
    try {
      await request({
        mode: "admin",
        operation: "rotateLink",
        locationId: local.id,
        version: local.version,
        confirmed: true,
        invalidateSessions: true,
      });
      router.refresh();
      setSuccess(
        "Linkul a fost regenerat. Copiază noul link după actualizarea paginii.",
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Operația nu a reușit.");
    } finally {
      setBusy(false);
    }
  }
  async function copy(local: Location) {
    try {
      await navigator.clipboard.writeText(
        new URL(local.link!, window.location.origin).href,
      );
      setSuccess(`Linkul pentru ${local.name} a fost copiat.`);
    } catch {
      setError(
        "Copierea nu a reușit. Verifică permisiunile clipboardului și încearcă din nou.",
      );
    }
  }
  function changeLocation(value: number | null) {
    if (
      dirty &&
      !window.confirm(
        "Schimbi localul? Selecția curentă de produse va fi golită.",
      )
    )
      return false;
    if (location && dirty) {
      try {
        sessionStorage.removeItem(
          `kaja-b2b-cart:admin:${location.id}:${editing?.id ?? "new"}`,
        );
      } catch {}
    }
    setSelected(value);
    setEditing(null);
    setDirty(false);
    setShowOrder(false);
    setSuccess("");
    return true;
  }
  return (
    <div className="workspace-content b2b-admin">
      <nav className="catalogue-submenu filter-nav" aria-label="B2B">
        <a
          href="/b2b?tab=locations"
          className={view === "locations" ? "active" : undefined}
          onClick={(e) => {
            e.preventDefault();
            switchView("locations");
          }}
        >
          Localuri
        </a>
        <a
          href="/b2b?tab=history"
          className={view === "history" ? "active" : undefined}
          onClick={(e) => {
            e.preventDefault();
            switchView("history");
          }}
        >
          Istoric Comenzi
        </a>
      </nav>
      {view === "locations" && (
        <div className="b2b-toolbar">
          <input
            aria-label="Caută localuri"
            placeholder="Caută local…"
            value={locationSearch}
            onChange={(e) => setLocationSearch(e.target.value)}
          />
          <button className="button" onClick={() => setLocationForm("new")}>
            Adaugă local
          </button>
        </div>
      )}
      <Feedback error={error} success={success} />
      {view === "locations" && locationForm && (
        <LocationForm
          key={locationForm === "new" ? "new" : locationForm.id}
          modal={locationForm === "new"}
          location={locationForm === "new" ? undefined : locationForm}
          onDone={() => setLocationForm(null)}
        />
      )}
      {view === "locations" && (
        <section className="b2b-location-list" aria-label="Lista localurilor">
          <div className="b2b-list-head" aria-hidden="true">
            <span>Local</span>
            <span>Adresă</span>
            <span>Persoană contact</span>
            <span>Nr. telefon</span>
            <span>Cashback</span>
            <span>Acțiuni</span>
            <span />
          </div>
          {matchingLocations.map((local) => (
            <article
              key={local.id}
              className="b2b-location-row"
              aria-label={local.name}
            >
              <div className="b2b-location-cell">
                <h3 className="item-title">{local.name}</h3>
              </div>
              <div className="b2b-location-cell">
                <p>{local.address}</p>
              </div>
              <div className="b2b-location-cell">{local.contact}</div>
              <div className="b2b-location-cell">
                <a href={"tel:" + local.phone.replace(/[^+\d]/g, "")}>
                  {local.phone}
                </a>
              </div>
              <div className="b2b-location-balance">
                <span className="b2b-mobile-label">Cashback</span>
                <strong>{money(local.cashback)}</strong>
              </div>
              <div className="b2b-row-actions">
                <button className="button ghost" onClick={() => copy(local)}>
                  Copiază linkul
                </button>
                <LocationActions
                  name={local.name}
                  actions={[
                    ...(manager
                      ? [
                          {
                            label: "Comandă pentru acest local",
                            run: () => {
                              if (
                                selected !== local.id &&
                                !changeLocation(local.id)
                              )
                                return;
                              setSelected(local.id);
                              setEditing(null);
                              setShowOrder(true);
                            },
                          },
                        ]
                      : []),
                    {
                      label: "Vezi linkul",
                      run: () => {
                        setError("");
                        setSuccess("");
                        setLinkLocation(local.id);
                      },
                    },
                    ...(manager
                      ? [
                          {
                            label: "Editează",
                            run: () => setLocationForm(local),
                          },
                          {
                            label: "Generează link nou",
                            run: () => {
                              void rotate(local);
                            },
                            disabled: busy,
                          },
                        ]
                      : []),
                  ]}
                />
              </div>
            </article>
          ))}
          {!data.locations.length ? (
            <p className="b2b-empty">Nu există localuri încă.</p>
          ) : (
            !matchingLocations.length && (
              <p className="b2b-empty">Nu există localuri potrivite.</p>
            )
          )}
        </section>
      )}
      {visibleLink && (
        <ConfirmDialog
          title={"Link de acces · " + visibleLink.name}
          busy={false}
          onClose={() => setLinkLocation(null)}
        >
          <label className="b2b-link-label">
            Link secret
            <input
              aria-label="Link secret complet"
              readOnly
              value={origin + visibleLink.link}
              onFocus={(e) => e.currentTarget.select()}
            />
          </label>
          <div className="b2b-actions">
            <button className="button" onClick={() => copy(visibleLink)}>
              Copiază linkul
            </button>
          </div>
          <Feedback error={error} success={success} />
        </ConfirmDialog>
      )}
      {view === "history" && (
        <LocationFilter
          locations={data.locations}
          value={historyLocation}
          onChange={setHistoryLocation}
        />
      )}
      {manager && location && (
        <>
          {showOrder && (
            <div className="b2b-actions">
              {showOrder && (
                <button
                  className="button ghost"
                  onClick={() => {
                    setShowOrder(false);
                    setEditing(null);
                  }}
                >
                  Închide formularul
                </button>
              )}
            </div>
          )}
          {showOrder &&
            (editOrder?.status === "paid" ? (
              <p>Comanda este achitată și nu mai poate fi modificată.</p>
            ) : (
              <OrderEditor
                key={`${location.id}:${editing?.id ?? "new"}:${editOrder?.version ?? 0}`}
                location={location}
                products={data.products}
                mode="admin"
                order={editOrder}
                onCartChange={setDirty}
                onDone={(id) => {
                  setShowOrder(false);
                  setEditing(null);
                  setDirty(false);
                  setSuccess(
                    `Comanda #${id} a fost salvată pentru ${location.name}.`,
                  );
                }}
              />
            ))}
        </>
      )}
      {view === "history" && (
        <History
          orders={data.orders.filter(
            (o) => !historyLocation || o.location_id === historyLocation,
          )}
          manager={manager}
          allowEdit={manager}
          onEdit={(order) => {
            if (
              dirty &&
              !window.confirm(
                "Deschizi altă comandă? Selecția curentă rămâne salvată în această sesiune.",
              )
            )
              return;
            setSelected(order.location_id);
            setEditing(order);
            setShowOrder(true);
            setDirty(false);
            setSuccess("");
          }}
        />
      )}
    </div>
  );
}
