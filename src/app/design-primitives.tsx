import type { InputHTMLAttributes } from "react";
import { NavigationIcon } from "./navigation-icon";
export function SearchField(props: InputHTMLAttributes<HTMLInputElement>) {
  return <div className="search-field"><NavigationIcon name="search" /><input type="search" {...props} /></div>;
}
export function ProductPlaceholder() {
  return <span className="product-placeholder" aria-hidden="true"><NavigationIcon name="product" /></span>;
}
