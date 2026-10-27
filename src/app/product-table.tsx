import type { ReactNode } from "react";

export function ProductTable({ columns, variant = "", label, children }: { columns: string[]; variant?: string; label: string; children: ReactNode }) {
  return <div className="product-table-scroll" role="region" aria-label={label} tabIndex={0}>
    <div className={`product-table ${variant}`} role="table" aria-label={label}>
      <div role="rowgroup"><div className="product-table-head" role="row">{columns.map(column=><span key={column} role="columnheader">{column}</span>)}<span role="columnheader" aria-label="Deschide detaliile" /></div></div>
      <div role="rowgroup">{children}</div>
    </div>
  </div>;
}
