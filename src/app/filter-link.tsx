"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { normalizeProductSort } from "../lib/product-list-sort";
import type { ComponentProps } from "react";

function withProductSort(href: ComponentProps<typeof Link>["href"], sort: string | null, search: string | null) {
  if (typeof href === "string") {
    const target=new URL(href,"https://kaja.local");
    const catalogue=target.pathname === "/" && target.searchParams.get("view") === "catalogue";
    const feedback=target.pathname === "/feedback" && target.searchParams.get("tab") !== "history";
    if (catalogue || feedback) {
      const usage=catalogue && target.searchParams.get("brand") === "kaja" && (target.searchParams.get("catalogue") ?? "live") === "live";
      if(sort)target.searchParams.set("sort",normalizeProductSort(sort,usage));
      if(search)target.searchParams.set("q",search);
      href=target.pathname+target.search;
    }
  }
  return href;
}

export function FilterLink({ onClick, ...props }: ComponentProps<typeof Link>) {
  const params=useSearchParams();
  const href=withProductSort(props.href,params.get("sort"),params.get("q"));
  return <Link
    {...props}
    href={href}
    scroll={false}
    onClick={(event) => {
      onClick?.(event);
      if (
        event.defaultPrevented
        || event.button !== 0
        || event.metaKey
        || event.ctrlKey
        || event.shiftKey
        || event.altKey
      ) return;

      document.querySelectorAll<HTMLDetailsElement>(".composer-toggle[open]").forEach((composer) => {
        composer.open = false;
      });
      window.dispatchEvent(new Event("workspace-filter-change"));
    }}
  />;
}
