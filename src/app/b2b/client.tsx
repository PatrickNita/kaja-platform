"use client";
import "./b2b.css";
import { PublicLanguageProvider, usePortalLanguage, LanguageSelector } from "../public-language";
import { matchesProduct, type PublicLanguage } from "../../lib/public-language";
import { requestError } from "../../lib/b2b/errors";
import Image from "next/image";
import { NavigationIcon } from "../navigation-icon";
import { ProductRow } from "./product-row";
import { SearchField } from "../design-primitives";
import { ConfirmDialog, Feedback, request } from "./ui";
import { History } from "./order-history";
import { StockAdmin } from "./stock-admin";
import { FilterSelect } from "./filter-select";
import { sortLocations, formatOrderDate } from "../../lib/b2b/presentation";
import { contactKey } from "../../lib/b2b/contact";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import {
  stockLimit,
  canManageOrders,
  money,
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

function LocationGuide({
  location,
  link,
  onClose,
}: {
  location: Location;
  link: string;
  onClose: () => void;
}) {
  const [language, setLanguage] = useState<"ro" | "ru">("ro");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const text =
    language === "ro"
      ? `Salut! Acesta este linkul de comandă pentru localul vostru:

${link}

Alegeți produsele cu + / −, apăsați „Verifică comanda”, apoi „Plasează comanda”. Puteți căuta după denumire sau gust.

În „Istoric comenzi” vedeți comenzile și starea lor. Le puteți modifica până la confirmare. După achitare, primiți 5% cashback, afișat în cont.

Păstrați linkul: este accesul privat al localului vostru. Nu îl distribuiți în afara echipei.

Pentru suport, contactați-ne pe Telegram: 076922600.`
      : `Здравствуйте! Это ссылка для заказов вашего заведения:

${link}

Выберите RU в правом верхнем углу. Выберите товары кнопками + / −, нажмите «Проверить заказ», затем «Оформить заказ». Можно искать по названию или вкусу.

В разделе «История заказов» доступны ваши заказы и их статус. Заказ можно изменить до подтверждения. После оплаты начисляется кешбэк 5%, который отображается в вашем аккаунте.

Сохраните ссылку: это личный доступ вашего заведения. Не передавайте её за пределы вашей команды.

По вопросам поддержки пишите в Telegram: 076922600.`;
  async function copyGuide() {
    setError("");
    setSuccess("");
    try {
      await navigator.clipboard.writeText(text);
      setSuccess("Ghidul a fost copiat.");
    } catch {
      setError("Copierea nu a reușit. Selectează textul și copiază-l manual.");
    }
  }
  return (
    <ConfirmDialog
      title={"Ghid localuri · " + location.name}
      busy={false}
      onClose={onClose}
      className="b2b-guide"
    >
      <div className="b2b-actions" role="group" aria-label="Limba ghidului">
        {(["ro", "ru"] as const).map((value) => (
          <button
            key={value}
            className={language === value ? "button" : "button ghost"}
            aria-pressed={language === value}
            onClick={() => {
              setLanguage(value);
              setError("");
              setSuccess("");
            }}
          >
            {value.toUpperCase()}
          </button>
        ))}
      </div>
      <div className="b2b-guide-text" lang={language} tabIndex={0}>
        {text}
      </div>
      <div className="b2b-guide-footer">
        <Feedback error={error} success={success} />
        <button className="button" onClick={copyGuide}>
          Copiază ghidul
        </button>
      </div>
    </ConfirmDialog>
  );
}

function LocationDetails({
  location,
  totalCashback,
}: {
  location: Location;
  totalCashback?: number;
}) {
  const { t } = usePortalLanguage();
  return (
    <section
      className="card-wrap b2b-location-details"
      aria-label={t("Datele localului")}
    >
      <div className="b2b-location-identity">
        <h2 className="item-title b2b-location-name">{location.name}</h2>
        <p className="b2b-location-address">{location.address}</p>
      </div>
      <div className="b2b-location-contact">
      <p className="b2b-location-person">{location.contact}</p>
      <a
        className="b2b-location-phone"
        href={"tel:" + location.phone.replace(/[^+\d]/g, "")}
      >
        {location.phone}
      </a>
      </div>
      <p className="b2b-cashback">
        {totalCashback === undefined ? t("CASHBACK") : t("CASHBACK TOTAL")}:{" "}
        <strong>{money(totalCashback ?? location.cashback)}</strong>
      </p>
    </section>
  );
}

function LocationForm({
  location,
  onDone,
  modal = false,
  internalFields = false,
}: {
  internalFields?: boolean;
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
    const contactChanged = Boolean(
      location &&
      contactKey(location.contact, location.phone) !==
        contactKey(String(values.contact), String(values.phone)),
    );
    if (
      contactChanged &&
      !window.confirm(
        "Schimbarea contactului modifică accesul la acest local: vechiul contact pierde accesul, iar noul contact îl primește. Comenzile și cashbackul localului se păstrează. Confirmi?",
      )
    )
      return;
    setBusy(true);
    setError("");
    try {
      await request({
        confirmContactChange: contactChanged,
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
      {location && internalFields && (
        <>
          <label>
            Denumire SRL
            <input
              name="companyName"
              maxLength={160}
              defaultValue={location.company_name ?? ""}
            />
          </label>
          <label>
            IDNO
            <input
              name="idno"
              maxLength={32}
              defaultValue={location.idno ?? ""}
            />
          </label>
        </>
      )}
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
      title={location ? "Modifică local" : "Adaugă local"}
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
  modal = false,
  onClose,
}: {
  modal?: boolean;
  onClose?: () => void;
  hideHeading?: boolean;
  location: Location;
  products: Product[];
  mode: "admin" | "portal";
  order?: Order;
  onDone: (id: number) => void;
  onCartChange?: (dirty: boolean) => void;
}) {
  const { language, t, flavor } = usePortalLanguage();
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
                      p,
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
      setError(requestError(e, "Trimiterea nu a reușit."));
    } finally {
      setBusy(false);
      inFlight.current = false;
    }
  }
  const editor = (
    <section
      className="b2b-editor"
      aria-label={order ? t("Modifică comanda") : t("Comandă nouă")}
    >
      {!hideHeading && (
        <h2>{order ? t(`Modifică comanda #${order.id}`) : t("Comandă nouă")}</h2>
      )}
      <SearchField
        className="b2b-product-search"
        type="search"
        aria-label={t("Caută după denumire sau gust")}
        placeholder={t("Caută după denumire sau gust…")}
        value={productSearch}
        onChange={(event) => setProductSearch(event.target.value)}
      />
      {!products.some((p) =>
        matchesProduct(p, productSearch),
      ) && <p role="status">{t("Nu există produse care corespund căutării.")}</p>}
      <div className="b2b-products">
        {products
          .filter((p) =>
            matchesProduct(p, productSearch),
          )
          .map((product) => (
            <ProductRow product={product} key={product.id}>
                <div className="b2b-quantity">
                  <button
                    type="button"
                    aria-label={t(`Scade ${product.name}`)}
                    disabled={!ready || busy || !(counts[product.id] > 0)}
                    onClick={() =>
                      setCounts((c) => ({
                        ...c,
                        [product.id]: Math.max(0, (c[product.id] ?? 0) - 1),
                      }))
                    }
                  >
                    <span className="b2b-quantity-glyph">−</span>
                  </button>
                  <output
                    aria-label={t(`Cantitate ${product.name}`)}
                    aria-live="polite"
                  >
                    {counts[product.id] ?? 0}
                  </output>
                  <button
                    type="button"
                    aria-label={t(`Adaugă ${product.name}`)}
                    disabled={
                      !ready ||
                      busy ||
                      (counts[product.id] ?? 0) >=
                        stockLimit(
                          product,
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
                    <span className="b2b-quantity-glyph">+</span>
                  </button>
                </div>
            </ProductRow>
          ))}
      </div>
      <div className="b2b-cart-bar">
        <div>
          <strong>
            {units} {t("buc. · ")}{money(total)}
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
        >{t("Verifică")} {order ? t("modificările") : t("comanda")}
        </button>
      </div>
      <Feedback error={!review ? error : ""} />
    </section>
  );
  return <>{modal ? !review && <ConfirmDialog title="Comandă nouă" busy={busy} onClose={() => onClose?.()} className="b2b-location-order">{editor}</ConfirmDialog> : editor}
      {review && (
        <ConfirmDialog
          className="b2b-checkout b2b-confirmation"
          busy={busy}
          onClose={() => setReview(false)}
        >
          <div className="b2b-checkout-destination">
            <p className="b2b-checkout-location">
              <strong>{location.name}</strong>
              <span aria-hidden="true"> · </span>
              {order ? order.location_snapshot.address : location.address}
            </p>
          </div>
          <h4 className="b2b-checkout-label b2b-checkout-products-title">{t("Produse selectate")}</h4>
          <ul
            className="b2b-review b2b-checkout-list"
            aria-label={t("Produsele comenzii")}
          >
            {selected.map((p) => (
              <li key={p.id}>
                <span className="b2b-checkout-product">
                  <strong>{p.name}</strong>
                  <span className="b2b-checkout-flavor"> · {flavor(p.flavor)}</span>
                </span>
                <span className="b2b-checkout-amount">
                  <span className="b2b-line-units">{counts[p.id]} {t("buc.")}</span>
                  <strong className="b2b-line-price">{money(p.price * counts[p.id])}</strong>
                </span>
              </li>
            ))}
          </ul>
          <div className="b2b-checkout-footer">
            <p className="b2b-checkout-total">
              <span>{t("Total")}</span>
              <span className="b2b-checkout-amount">
                {units} {t("buc. · ")}<strong>{money(total)}</strong>
              </span>
            </p>
            <Feedback error={error} />
            <button className="button" disabled={busy} onClick={submit}>
              {busy
                ? t("Se trimite…")
                : order
                  ? t("Salvează modificările")
                  : t("Plasează comanda")}
            </button>
          </div>
        </ConfirmDialog>
      )}
  </>;
}

export function B2BPortal({ data, initialLanguage = "ro" }: { data: B2BData; initialLanguage?: PublicLanguage }) {
  return <PublicLanguageProvider initialLanguage={initialLanguage}><PortalContent data={data} /></PublicLanguageProvider>;
}
function PortalContent({ data }: { data: B2BData }) {
  const { language, setLanguage, t } = usePortalLanguage();
  const [view, setView] = useState<"order" | "history">("order");
  const [success, setSuccess] = useState("");
  const [selectedLocation, setSelectedLocation] = useState<number | null>(null);
  const [choosingLocation, setChoosingLocation] = useState(false);
  const locationSwitchTrigger = useRef<HTMLButtonElement>(null);
  function closeLocationPicker() {
    setChoosingLocation(false);
    requestAnimationFrame(() => locationSwitchTrigger.current?.focus());
  }
  const storageKey =
    "kaja-b2b-location:" +
    (data.locations[0]?.access_group_id ?? data.locations[0]?.id ?? "none");
  useEffect(() => {
    try {
      const previous = Number(localStorage.getItem(storageKey));
      if (data.locations.some((l) => l.id === previous))
        setSelectedLocation(previous);
    } catch {}
  }, [storageKey, data.locations]);
  const location =
    data.locations.find((l) => l.id === selectedLocation) ?? data.locations[0];
  const totalCashback =
    data.locations.length > 1
      ? data.locations.reduce((sum, l) => sum + l.cashback, 0)
      : undefined;
  function switchLocation(next: Location) {
    if (next.id !== location.id) {
      setSelectedLocation(next.id);
      setSuccess("");
      try {
        localStorage.setItem(storageKey, String(next.id));
      } catch {}
    }
    closeLocationPicker();
  }
  if (!location)
    return (
      <p role="alert">{t("Accesul la local nu mai este disponibil. Redeschide linkul de acces.")}</p>
    );
  return (
    <main className="b2b-portal" lang={language}>
      <header className="b2b-portal-header">
        <Image
          className="logo"
          src="/kaja-logo.png"
          alt="KAJA"
          width={1024}
          height={240}
          priority
        />
        <LanguageSelector language={language} setLanguage={setLanguage} />
      </header>
      <div className={"portal-location-row" + (data.locations.length > 1 ? " has-switch" : "")} >
      <section className="portal-location-panel" aria-label={location.name}>
        <div className="portal-location-main"><span className="icon-tile"><NavigationIcon name="b2b" /></span><div className="portal-location-copy"><h2>{location.name}</h2><p><NavigationIcon name="pin" />{location.address}</p><p className="portal-cashback">{t(totalCashback === undefined ? "Cashback:" : "Cashback total:")} <strong>{money(totalCashback ?? location.cashback)}</strong></p></div></div>
        <div className="portal-location-contact"><strong>{location.contact || "—"}</strong>{location.phone ? <a href={"tel:" + location.phone.replace(/[^+\d]/g, "")}>{location.phone}</a> : <span>—</span>}</div>
      </section>
        {data.locations.length > 1 && <button ref={locationSwitchTrigger} type="button" className="location-switch" aria-haspopup="dialog" onClick={() => setChoosingLocation(true)}><span>{t("Schimbă locația")}</span><NavigationIcon name="chevron" /></button>}
      </div>
      <nav className="portal-view-tabs" aria-label={t("Navigare comenzi")}>
        <button aria-pressed={view === "order"} className={view === "order" ? "active" : ""} onClick={() => { setView("order"); setSuccess(""); }}>{t("Comandă nouă")}</button>
        <button aria-label={t("Istoric comenzi")} aria-pressed={view === "history"} className={view === "history" ? "active" : ""} onClick={() => { setView("history"); setSuccess(""); }}>{t("Istoric")}</button>
      </nav>
      {choosingLocation && (
        <ConfirmDialog
          title={t("Schimbă locația")}
          busy={false}
          onClose={closeLocationPicker}
          className="b2b-location-picker"
        >
          <div className="b2b-location-options">
            {data.locations.map((local) => (
              <button
                key={local.id}
                className={local.id === location.id ? "button" : "button ghost"}
                aria-pressed={local.id === location.id}
                title={`${local.name} · ${local.address}`}
                onClick={() => switchLocation(local)}
              >
                <strong>{local.name}</strong>
                <span className="b2b-location-option-address">
                  · {local.address}
                </span>
              </button>
            ))}
          </div>
        </ConfirmDialog>
      )}
      <Feedback success={success} />
      {view === "order" && (
        <div id="formular-comanda">
          <OrderEditor
            key={location.id}
            hideHeading
            mode="portal"
            location={location}
            products={data.products}
            onDone={(id) => setSuccess(`Comanda #${id} a fost plasată.`)}
          />
        </div>
      )}
      {view === "history" && (
        <div id="istoric-comenzi">
          <History
            hideHeading
            orders={data.orders.filter((o) => o.location_id === location.id)}
            products={data.products}
            manager={false}
            allowEdit
            mode="portal"
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
          trigger.current?.closest("dialog") ?? document.body,
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

export type LocationPayload = { location: Location; products: Product[]; memberSlug: string };
export function LocationFlow({ initial, onClose, onChanged }: { initial: LocationPayload; onClose: () => void; onChanged?: () => void }) {
  const router = useRouter();
  const [data, setData] = useState(initial);
  const [screen, setScreen] = useState<"details" | "guide" | "link" | "edit" | "order">("details");
  const [busy, setBusy] = useState(false), [error, setError] = useState(""), [success, setSuccess] = useState("");
  const [dirty, setDirty] = useState(false);
  const [origin, setOrigin] = useState("");
  const refreshController = useRef<AbortController | null>(null);
  useEffect(() => { setOrigin(window.location.origin); return () => refreshController.current?.abort(); }, []);
  const detail = data.location, manager = canManageOrders(data.memberSlug);
  async function refresh() {
    refreshController.current?.abort(); const pending = new AbortController(); refreshController.current = pending;
    setBusy(true); setError("");
    try {
      const response = await fetch(`/api/b2b/locations/${detail.id}`, { cache: "no-store", signal: pending.signal });
      const value = await response.json(); if (!response.ok) throw Error(value.error);
      if (!pending.signal.aborted) { setData(value); router.refresh(); onChanged?.(); }
    } catch (e) { if (!pending.signal.aborted) setError(e instanceof Error ? e.message : "Actualizarea nu a reușit."); }
    finally { if (!pending.signal.aborted) setBusy(false); }
  }
  async function copy(local: Location) {
    try { await navigator.clipboard.writeText(new URL(local.link!, window.location.origin).href); setSuccess(`Linkul pentru ${local.name} a fost copiat.`); }
    catch { setError("Copierea nu a reușit. Verifică permisiunile clipboardului și încearcă din nou."); }
  }
  async function rotate(local: Location) {
    if (!window.confirm(`Generezi un link nou pentru toate cele ${local.group_size ?? 1} localuri ale acestui contact?`) || !window.confirm("Linkul comun vechi și toate sesiunile deschise cu el vor expira imediat pentru toate localurile acestui contact. Confirmi definitiv regenerarea?")) return;
    setBusy(true); setError("");
    try { await request({ mode:"admin", operation:"rotateLink", groupId:local.access_group_id, locationId:local.id, version:local.version, confirmed:true, invalidateSessions:true }); await refresh(); setSuccess("Linkul a fost regenerat."); }
    catch (e) { setError(e instanceof Error ? e.message : "Operația nu a reușit."); }
    finally { setBusy(false); }
  }
  function locationActions(local: Location) {
    const go = (next: typeof screen) => { setError(""); setSuccess(""); setScreen(next); };
    return [
      ...(manager ? [{label:"Comandă pentru acest local",run:()=>go("order")}] : []),
      {label:"Vezi linkul",run:()=>go("link")}, {label:"Ghid localuri",run:()=>go("guide")},
      ...(manager ? [{label:"Editează",run:()=>go("edit")},{label:"Generează link nou",run:()=>{void rotate(local);},disabled:busy}] : []),
    ];
  }
  const back = () => { setScreen("details"); setDirty(false); void refresh(); };
  return <>
    {screen === "details" && (
        <ConfirmDialog
          title={detail.name}
          className="b2b-location-info"
          busy={busy}
          onClose={onClose}
        >
          <div className="b2b-location-info-body">
            <div className="b2b-location-info-group">
              <span className="b2b-info-label">Local și adresă</span>
              <strong>{detail.name}</strong>
              <span>{detail.address}</span>
            </div>
            <div className="b2b-location-info-group">
              <span className="b2b-info-label">Persoană de contact</span>
              <strong>{detail.contact}</strong>
              <a href={"tel:" + detail.phone.replace(/[^+\d]/g, "")}>
                {detail.phone}
              </a>
            </div>
            <div className="b2b-location-info-pair">
              <div className="b2b-location-info-group">
                <span className="b2b-info-label">Cashback</span>
                <strong>{money(detail.cashback)}</strong>
                <span className="b2b-info-label">Total comenzi: {detail.order_count ?? 0}</span>
              </div>
              <div className="b2b-location-info-group">
                <span className="b2b-info-label">Ultima comandă</span>
                <span>
                  {detail.last_order_at
                    ? formatOrderDate(detail.last_order_at)
                    : "Fără comenzi"}
                </span>
              </div>
            </div>
            {manager && (
              <div className="b2b-location-info-pair">
                <div className="b2b-location-info-group">
                  <span className="b2b-info-label">Denumire SRL</span>
                  <span>{detail.company_name || "—"}</span>
                </div>
                <div className="b2b-location-info-group">
                  <span className="b2b-info-label">IDNO</span>
                  <span>{detail.idno || "—"}</span>
                </div>
              </div>
            )}
          </div>
          <div className="b2b-location-info-actions">
            <button className="button ghost" onClick={() => copy(detail)}>
              Copiază linkul
            </button>
            <LocationActions
              name={detail.name}
              actions={locationActions(detail)}
            />
          </div>
          <Feedback error={error} success={success} />
          {error && <button type="button" className="button ghost" disabled={busy} onClick={() => void refresh()}>Reîncarcă detaliile</button>}
        </ConfirmDialog>

    )}
    {screen === "guide" && <LocationGuide location={detail} link={origin + detail.link} onClose={() => setScreen("details")} />}
    {screen === "link" && <ConfirmDialog title={"Link de acces · " + detail.name} busy={busy} onClose={() => setScreen("details")}><label className="b2b-link-label">Link secret<input aria-label="Link secret complet" readOnly value={origin + detail.link} onFocus={e => e.currentTarget.select()} /></label><button className="button" onClick={() => copy(detail)}>Copiază linkul</button><Feedback error={error} success={success} /></ConfirmDialog>}
    {screen === "edit" && manager && <LocationForm modal internalFields location={detail} onDone={back} />}
    {screen === "order" && manager && <OrderEditor location={detail} products={data.products} mode="admin" modal onClose={() => { if (!dirty || window.confirm("Renunți la produsele selectate?")) setScreen("details"); }} onCartChange={setDirty} onDone={id => { setSuccess(`Comanda #${id} a fost salvată pentru ${detail.name}.`); back(); }} />}
  </>;
}

export function B2BAdmin({
  data,
  memberSlug,
  initialView = "locations",
}: {
  data: B2BData;
  memberSlug: string;
  initialView?: "locations" | "history" | "stock";
}) {
  const manager = canManageOrders(memberSlug);
  const [view, setView] = useState(initialView === "stock" && !manager ? "locations" : initialView);
  const [locationSearch, setLocationSearch] = useState("");
  const [locationSort, setLocationSort] = useState("name");
  const [detailsLocation, setDetailsLocation] = useState<number | null>(null);
  const detailsTrigger = useRef<HTMLButtonElement | null>(null);
  const [historyLocation, setHistoryLocation] = useState<number | null>(null);
  useEffect(() => {
    const sync = () =>
      setView(new URLSearchParams(window.location.search).get("tab") === "stock" && manager ? "stock" : new URLSearchParams(window.location.search).get("tab") === "history" ? "history" : "locations");
    window.addEventListener("popstate", sync);
    return () => window.removeEventListener("popstate", sync);
  }, [manager]);
  function switchView(next: "locations" | "history" | "stock") {
    if (next === "stock" && !manager) return;
    setDetailsLocation(null);
    setLocationForm(null);
    setView(next);
    const url = new URL(window.location.href);
    url.searchParams.set("tab", next);
    window.history.pushState(null, "", url);
  }

  const [locationForm, setLocationForm] = useState<Location | "new" | null>(null);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const matchingLocations = sortLocations(
    data.locations.filter((local) =>
      searchKey(local.name).includes(searchKey(locationSearch)),
    ),
    locationSort,
  );
  const detail = data.locations.find((l) => l.id === detailsLocation);
  return (
    <div className="workspace-content b2b-admin">
      <div className="b2b-section-navigation">
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
        {manager && <a href="/b2b?tab=stock" className={view === "stock" ? "active" : undefined} onClick={event => {event.preventDefault();switchView("stock");}}>Administrare stoc</a>}
      </nav>
      {view === "locations" && <button className="button b2b-add-mobile" onClick={() => setLocationForm("new")}>Adaugă local</button>}
      </div>
      {view === "locations" && (
        <div className="b2b-toolbar">
          <SearchField
            aria-label="Caută localuri"
            placeholder="Caută local…"
            value={locationSearch}
            onChange={(e) => setLocationSearch(e.target.value)}
          />
          <FilterSelect
            label="Sortare localuri"
            value={locationSort}
            options={[
              { value: "name", label: "Denumire A–Z" },
              { value: "latest", label: "Ultima comandă — cele mai recente" },
              { value: "oldest", label: "Ultima comandă — cele mai vechi" },
            ]}
            onChange={setLocationSort}
          />
          <button className="button b2b-add-desktop" onClick={() => setLocationForm("new")}>
            Adaugă local
          </button>
        </div>
      )}
      {view === "stock" && manager && <StockAdmin />}
      <Feedback error={error} success={success} />
      {view === "locations" && locationForm && (
        <LocationForm
          key={locationForm === "new" ? "new" : locationForm.id}
          modal
          internalFields={manager}
          location={locationForm === "new" ? undefined : locationForm}
          onDone={() => setLocationForm(null)}
        />
      )}
      {view === "locations" && (
        <section
          className={`b2b-location-list b2b-summary-table${manager ? " b2b-summary-manager" : ""}`}
          aria-label="Lista localurilor"
        >
          <div className="b2b-summary-scroll"><div className="b2b-summary-content">
          <div className="b2b-list-head" aria-hidden="true"><span>Local</span><span>Adresă</span><span>Pers. contact</span><span>Nr. de telefon</span>{manager && <><span>Denumire SRL</span><span>IDNO</span></>}<span>Ultima comandă</span><span>Total comenzi</span><span>Cashback total</span><span /></div>
          {matchingLocations.map((local) => (
            <div key={local.id} className="b2b-location-entry">
              <button
                type="button"
                className="b2b-mobile-location"
                aria-haspopup="dialog"
                aria-label={"Detalii pentru " + local.name}
                onClick={(event) => {
                  detailsTrigger.current = event.currentTarget;
                  setError("");
                  setSuccess("");
                  setDetailsLocation(local.id);
                }}
              >
                <strong>{local.name}</strong>
                <span className="b2b-mobile-address">{local.address}</span>
                <time className="b2b-mobile-last" dateTime={local.last_order_at ?? undefined} aria-label={local.last_order_at ? "Ultima comandă: " + formatOrderDate(local.last_order_at) : "Fără comenzi"}>{local.last_order_at ? new Intl.DateTimeFormat("ro-RO", {dateStyle:"short",timeStyle:"short",timeZone:"Europe/Chisinau"}).format(new Date(local.last_order_at)) : "Fără comenzi"}</time>
              </button>
              <button type="button" className="b2b-location-row b2b-summary-row" aria-label={"Detalii pentru " + local.name} aria-haspopup="dialog" onClick={event => { detailsTrigger.current = event.currentTarget; setError(""); setSuccess(""); setDetailsLocation(local.id); }}>
                <span className="location-name-cell"><NavigationIcon name="b2b" /><strong>{local.name}</strong></span>
                <span>{local.address}</span>
                <span>{local.contact || "—"}</span>
                <span>{local.phone || "—"}</span>
                {manager && <><span>{local.company_name || "—"}</span><span>{local.idno || "—"}</span></>}
                <time dateTime={local.last_order_at ?? undefined}>{local.last_order_at ? formatOrderDate(local.last_order_at) : "—"}</time>
                <span>{local.order_count ?? data.orders.filter(o => o.location_id === local.id).length}</span>
                <span>{money(local.cashback)}</span><NavigationIcon name="chevron" />
              </button>
            </div>
          ))}
          {!data.locations.length ? (
            <p className="b2b-empty">Nu există localuri încă.</p>
          ) : (
            !matchingLocations.length && (
              <p className="b2b-empty">Nu există localuri potrivite.</p>
            )
          )}
          </div></div>
        </section>
      )}
      {detail && <LocationFlow key={detail.id} initial={{location:detail,products:data.products,memberSlug}} onClose={() => { setDetailsLocation(null); requestAnimationFrame(() => detailsTrigger.current?.focus({preventScroll:true})); }} />}
      {view === "history" && (
        <LocationFilter
          locations={data.locations}
          value={historyLocation}
          onChange={setHistoryLocation}
        />
      )}
      {view === "history" && (
        <History
          orders={data.orders.filter(
            (o) => !historyLocation || o.location_id === historyLocation,
          )}
          products={data.products}
          manager={manager}
          allowEdit={manager}
          mode="admin"
          hideHeading
        />
      )}
    </div>
  );
}
