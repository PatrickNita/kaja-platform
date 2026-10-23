"use client";
import { useEffect, useId, useRef, useState } from "react";
export function FilterSelect({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: { value: string; label: string }[];
  onChange: (value: string) => void;
}) {
  const [open, setOpen] = useState(false),
    [active, setActive] = useState(0);
  const root = useRef<HTMLDivElement>(null),
    trigger = useRef<HTMLButtonElement>(null),
    list = useRef<HTMLDivElement>(null);
  const id = useId();
  function close() {
    setOpen(false);
    trigger.current?.focus();
  }
  useEffect(() => {
    if (!open) return;
    const outside = (e: PointerEvent) => {
      if (!root.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", outside);
    return () => document.removeEventListener("pointerdown", outside);
  }, [open]);
  useEffect(() => {
    if (open)
      list.current
        ?.querySelectorAll<HTMLButtonElement>("button")
        [active]?.focus();
  }, [open, active]);
  return (
    <div
      className="b2b-filter b2b-select"
      ref={root}
      onKeyDown={(e) => {
        if (e.key === "Escape" && open) {
          e.preventDefault();
          e.stopPropagation();
          close();
        }
        if (e.key === "Tab") setOpen(false);
        if (["ArrowDown", "ArrowUp", "Home", "End"].includes(e.key)) {
          e.preventDefault();
          setOpen(true);
          setActive((i) =>
            e.key === "Home"
              ? 0
              : e.key === "End"
                ? options.length - 1
                : (i + (e.key === "ArrowDown" ? 1 : -1) + options.length) %
                  options.length,
          );
        }
      }}
    >
      <button
        type="button"
        ref={trigger}
        className="button ghost b2b-filter-trigger"
        aria-label={
          label + ": " + (options.find((o) => o.value === value)?.label ?? "")
        }
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={id}
        onClick={() => {
          setOpen(!open);
          setActive(
            Math.max(
              0,
              options.findIndex((o) => o.value === value),
            ),
          );
        }}
      >
        {options.find((o) => o.value === value)?.label}
        <svg className="b2b-filter-chevron" viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false"><path d="m6 9 6 6 6-6" /></svg>
      </button>
      {open && (
        <div className="b2b-filter-popup">
          <div id={id} ref={list} role="listbox" aria-label={label}>
            {options.map((o, i) => (
              <button
                type="button"
                role="option"
                aria-selected={o.value === value}
                tabIndex={i === active ? 0 : -1}
                key={o.value}
                className={i === active ? "active" : ""}
                onClick={() => {
                  onChange(o.value);
                  close();
                }}
              >
                {o.label}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
