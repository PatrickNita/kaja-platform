import { sql } from "drizzle-orm";

export type OrderRejectionContext = {
  body: Record<string, unknown>;
  actorSlug?: string;
  locationId?: number;
};

const positiveId = (value: unknown) => typeof value === "number" && Number.isSafeInteger(value) && value > 0 && value <= 2147483647 ? value : null;
const requestKey = (value: unknown) => typeof value === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value) ? value : null;

export function rejectionItems(body: Record<string, unknown>) {
  return (Array.isArray(body.quantities) ? body.quantities.slice(0, 25) : []).flatMap(value => {
    if (!value || typeof value !== "object") return [];
    const { productId, quantity } = value as Record<string, unknown>;
    return positiveId(productId) && positiveId(quantity) ? [{ productId: positiveId(productId)!, quantity: positiveId(quantity)! }] : [];
  });
}

export function stockFailureDetails(error: unknown): { productId: number; requestedDelta: number; available: number | null } | null {
  let current = error;
  for (let i = 0; i < 8 && current && typeof current === "object"; i++) {
    if ("detail" in current && typeof current.detail === "string") {
      try {
        const detail = JSON.parse(current.detail);
        if (positiveId(detail.productId) && Number.isSafeInteger(detail.requestedDelta) && (detail.available === null || Number.isSafeInteger(detail.available)))
          return { productId: detail.productId, requestedDelta: detail.requestedDelta, available: detail.available };
      } catch { /* Other database details are never copied into the audit log. */ }
    }
    current = "cause" in current ? current.cause : null;
  }
  return null;
}

export function failureDiagnostics(error: unknown) {
  const result: Record<string, string> = {};
  let current = error;
  for (let i = 0; i < 8 && current && typeof current === "object"; i++) {
    for (const key of ["name", "code", "constraint"] as const) {
      const value = key in current ? (current as Record<string, unknown>)[key] : null;
      if (typeof value === "string" && /^[a-zA-Z0-9_.-]{1,128}$/.test(value)) result[key] = value;
    }
    current = "cause" in current ? current.cause : null;
  }
  return Object.keys(result).length ? result : null;
}

export function rejectionStatement(context: OrderRejectionContext, attemptId: string, status: number, code: string, reason: string, error?: unknown) {
  const items = JSON.stringify(rejectionItems(context.body));
  const details = stockFailureDetails(error);
  const diagnostics = failureDiagnostics(error);
  return sql`insert into b2b_order_rejections(id,mode,actor_slug,location_id,location_name,order_id,request_key,http_status,error_code,reason,requested_items,stock_details,diagnostics)
    select ${attemptId}::uuid,${context.body.mode === "admin" ? "admin" : context.body.mode === "portal" ? "portal" : null},${context.actorSlug ?? null},l.id,l.name,
    ${positiveId(context.body.orderId)},${requestKey(context.body.requestKey)}::uuid,${status},${code},${reason},
    coalesce((select jsonb_agg(jsonb_build_object('productId',x."productId",'quantity',x.quantity,'name',p.name,'flavor',p.flavor) order by x."productId")
      from jsonb_to_recordset(${items}::jsonb) as x("productId" integer,quantity integer)
      left join b2b_products p on p.id=x."productId"),'[]'::jsonb),${details ? JSON.stringify(details) : null}::jsonb,${diagnostics ? JSON.stringify(diagnostics) : null}::jsonb
    from (select ${context.locationId ?? null}::integer as id) requested
    left join b2b_locations l on l.id=requested.id`;
}
