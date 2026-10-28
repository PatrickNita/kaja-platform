"use client";
import type { ReactNode } from "react";
import { ProductImage } from "../product-image";
import { usePortalLanguage } from "../public-language";
import { money, stockLabel, stockStatus, type Product } from "../../lib/b2b/model";

export function ProductRow({ product, children }: { product: Product; children: ReactNode }) {
  const { language, t, flavor } = usePortalLanguage();
  const status = stockStatus(product);
  return <article className="b2b-product">
    <ProductImage imageId={product.imageId} name={product.name} />
    <div className="b2b-product-info">
      <h3 className="item-title">{product.name}</h3>
      <p className="b2b-product-meta">{flavor(product.flavor)} · <span>{product.grams}{language === "ru" ? "г" : "g"}</span> · <span>{money(product.price)}</span></p>
    </div>
    <span className={`b2b-stock ${status}`}>{t(stockLabel[status])}</span>
    <div className="b2b-product-controls">{children}</div>
  </article>;
}
