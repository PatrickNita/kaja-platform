import type { ReactNode } from "react";
import { HorizontalScrollHints } from "./horizontal-scroll-hints";

export function ProductTable({ columns, variant = "", label, children }: { columns: string[]; variant?: string; label: string; children: ReactNode }) {
  return <HorizontalScrollHints className="product-table-scroll" label={label}>
    <div className={`product-table workspace-data-table ${variant}`} role="table" aria-label={label}>
      <div role="rowgroup"><div className="product-table-head workspace-data-head" role="row">{columns.map(column=><span key={column} role="columnheader">{column}</span>)}<span role="columnheader" aria-label="Deschide detaliile" /></div></div>
      <div role="rowgroup">{children}</div>
    </div>
  </HorizontalScrollHints>;
}
