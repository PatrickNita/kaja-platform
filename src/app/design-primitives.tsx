import type { ComponentPropsWithRef } from "react";
import { NavigationIcon } from "./navigation-icon";
export function SearchField({ showIcon = true, ...props }: ComponentPropsWithRef<"input"> & { showIcon?: boolean }) {
  return <div className={`search-field${showIcon ? "" : " search-field--plain"}`}>{showIcon && <NavigationIcon name="search" />}<input type="search" {...props} />{props.placeholder && <span className="search-field-placeholder" aria-hidden="true">{props.placeholder}</span>}</div>;
}
export function ProductPlaceholder() {
  return <span className="product-placeholder" aria-hidden="true"><NavigationIcon name="product" /></span>;
}
