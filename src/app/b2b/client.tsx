"use client";
import "./b2b.css";

import {
  useEffect,
  useRef,
  useState,
  type FormEvent,
  type ReactNode,
} from "react";
import { useRouter } from "next/navigation";
import {
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

async function request(body: Record<string, unknown>) {
  const response = await fetch("/api/b2b", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const result = await response.json();
  if (!response.ok)
    throw new Error(result.error ?? "Operația nu a reușit. Încearcă din nou.");
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
}: {
  children: ReactNode;
  onClose: () => void;
  busy: boolean;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    ref.current?.showModal();
    return () => ref.current?.close();
  }, []);
  return (
    <dialog
      className="b2b-dialog"
      ref={ref}
      onCancel={(event) => {
        event.preventDefault();
        if (!busy) onClose();
      }}
    >
      <div className="b2b-dialog-head">
        <h3>Confirmă comanda</h3>
        <button
          type="button"
          aria-label="Închide confirmarea"
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
    <section className="panel b2b-location-details">
      <h2>{location.name}</h2>
      <p>{location.address}</p>
      <p>
        {location.contact} ·{" "}
        <a href={`tel:${location.phone.replace(/[^+\d]/g, "")}`}>
          {location.phone}
        </a>
      </p>
      <p className="b2b-cashback">
        CASHBACK: <strong>{money(location.cashback)}</strong>
      </p>
    </section>
  );
}

function LocationForm({
  location,
  onDone,
}: {
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
  return (
    <form className="form b2b-form" onSubmit={save}>
      <h3>{location ? "Editează localul" : "Adaugă local"}</h3>
      <label>
        Denumirea locației
        <input
          name="name"
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
}

export function OrderEditor({
  location,
  products,
  mode,
  order,
  onDone,
  onCartChange,
}: {
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
                ? stored.counts[p.id]
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
      <h2>{order ? `Modifică comanda #${order.id}` : "Comandă nouă"}</h2>
      <p className="b2b-muted">KAJA · 200 g / buc. · 400 MDL / buc.</p>
      <div className="b2b-products">
        {products.map((product) => (
          <article className="b2b-product" key={product.id}>
            <div>
              <h3>{product.name}</h3>
              <p>{product.flavor}</p>
              <span>
                {product.grams} g · {money(product.price)}
              </span>
            </div>
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
                disabled={!ready || busy || (counts[product.id] ?? 0) >= 10000}
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
        <ConfirmDialog busy={busy} onClose={() => setReview(false)}>
          <h4>{location.name}</h4>
          <p>{order ? order.location_snapshot.address : location.address}</p>
          <ul className="b2b-review">
            {selected.map((p) => (
              <li key={p.id}>
                <span>
                  {p.name} · {counts[p.id]} buc.
                </span>
                <strong>{money(p.price * counts[p.id])}</strong>
              </li>
            ))}
          </ul>
          <p className="b2b-total">Total: {money(total)}</p>
          <p>Plata se face în afara platformei.</p>
          <Feedback error={error} />
          <button className="button" disabled={busy} onClick={submit}>
            {busy
              ? "Se trimite…"
              : order
                ? "Salvează modificările"
                : "Plasează comanda"}
          </button>
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
}: {
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
    <section className="b2b-history">
      <div className="b2b-order-heading">
        <h2>Istoricul comenzilor</h2>
        <button className="button ghost" onClick={() => router.refresh()}>
          Actualizează
        </button>
      </div>
      <Feedback error={error} />
      {orders.length === 0 && (
        <p className="b2b-muted">Nu există comenzi încă.</p>
      )}
      {orders.map((order) => (
        <article
          className="panel b2b-order"
          id={`comanda-${order.id}`}
          key={order.id}
        >
          <div className="b2b-order-heading">
            <h3>
              Comanda #{order.id} · {order.location_name}
            </h3>
            <span className={`b2b-status ${order.status}`}>
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
  const [editing, setEditing] = useState<Order | null>(null);
  const [success, setSuccess] = useState("");
  const location = data.locations[0];
  const currentEdit = editing
    ? data.orders.find((o) => o.id === editing.id)
    : null;
  return (
    <main className="b2b-portal">
      <header className="b2b-portal-header">
        <strong>KAJA</strong>
        <span>Comenzi pentru localuri</span>
      </header>
      <LocationDetails location={location} />
      <Feedback success={success} />
      <nav className="b2b-actions" aria-label="Navigare comenzi">
        <button
          className="button ghost"
          onClick={() => {
            setEditing(null);
            setSuccess("");
            document
              .getElementById("formular-comanda")
              ?.scrollIntoView({ behavior: "smooth" });
          }}
        >
          Comandă nouă
        </button>
        <a className="button ghost" href="#istoric-comenzi">
          Istoric comenzi
        </a>
      </nav>
      {editing && (
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
      <div id="istoric-comenzi">
        <History
          orders={data.orders}
          manager={false}
          allowEdit={true}
          onEdit={(order) => {
            setEditing(order);
            setSuccess("");
            document
              .getElementById("formular-comanda")
              ?.scrollIntoView({ behavior: "smooth" });
          }}
        />
      </div>
    </main>
  );
}

export function B2BAdmin({
  data,
  memberSlug,
}: {
  data: B2BData;
  memberSlug: string;
}) {
  const router = useRouter();
  const manager = canManageOrders(memberSlug);
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
      setError("Copierea nu a reușit. Selectează manual linkul afișat.");
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
      <div className="b2b-order-heading">
        <h1>B2B</h1>
        <button className="button" onClick={() => setLocationForm("new")}>
          Adaugă local
        </button>
      </div>
      <Feedback error={error} success={success} />
      {locationForm && (
        <LocationForm
          key={locationForm === "new" ? "new" : locationForm.id}
          location={locationForm === "new" ? undefined : locationForm}
          onDone={() => setLocationForm(null)}
        />
      )}
      <label className="b2b-location-select">
        Local
        <select
          value={selected ?? ""}
          onChange={(e) =>
            changeLocation(e.target.value ? Number(e.target.value) : null)
          }
        >
          <option value="">Toate localurile</option>
          {data.locations.map((l) => (
            <option key={l.id} value={l.id}>
              {l.name}
            </option>
          ))}
        </select>
      </label>
      <section className="b2b-locations">
        {data.locations
          .filter((l) => !selected || l.id === selected)
          .map((local) => (
            <article className="panel" key={local.id}>
              <LocationDetails location={local} />
              <label className="b2b-link-label">
                Link secret
                <input
                  readOnly
                  aria-label={`Link secret ${local.name}`}
                  value={origin + (local.link ?? "")}
                  onFocus={(e) => e.currentTarget.select()}
                />
              </label>
              <div className="b2b-actions">
                <button className="button ghost" onClick={() => copy(local)}>
                  Copiază linkul
                </button>
                <button
                  className="button ghost"
                  onClick={() => setLocationForm(local)}
                >
                  Editează localul
                </button>
                {manager && (
                  <>
                    <button
                      className="button ghost"
                      disabled={busy}
                      onClick={() => rotate(local)}
                    >
                      Generează link nou
                    </button>
                    <button
                      className="button"
                      onClick={() => {
                        if (selected !== local.id && !changeLocation(local.id))
                          return;
                        setSelected(local.id);
                        setEditing(null);
                        setShowOrder(true);
                      }}
                    >
                      Comandă pentru acest local
                    </button>
                  </>
                )}
              </div>
            </article>
          ))}
      </section>
      {manager && location && (
        <>
          <div className="b2b-actions">
            {!showOrder && (
              <button
                className="button"
                onClick={() => {
                  setEditing(null);
                  setShowOrder(true);
                }}
              >
                Comandă nouă pentru {location.name}
              </button>
            )}
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
      <History
        orders={data.orders.filter(
          (o) => !selected || o.location_id === selected,
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
    </div>
  );
}
