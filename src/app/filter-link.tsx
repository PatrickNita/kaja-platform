"use client";

import Link from "next/link";
import type { ComponentProps } from "react";

export function FilterLink({ onClick, ...props }: ComponentProps<typeof Link>) {
  return <Link
    {...props}
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
