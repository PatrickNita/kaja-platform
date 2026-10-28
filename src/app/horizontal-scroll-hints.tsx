"use client";
import { useEffect, useRef, useState, type ReactNode } from "react";

export function HorizontalScrollHints({ children, className, label }: { children: ReactNode; className: string; label: string }) {
  const scroller = useRef<HTMLDivElement>(null);
  const [edges, setEdges] = useState({ left: false, right: false });
  useEffect(() => {
    const element = scroller.current;
    if (!element) return;
    const measure = () => {
      const scrollable = /auto|scroll/.test(getComputedStyle(element).overflowX);
      const left = scrollable && element.scrollLeft > 2;
      const right = scrollable && element.scrollWidth - element.clientWidth - element.scrollLeft > 2;
      for (const [edge, visible] of [["left", left], ["right", right]] as const) {
        if (!visible && document.activeElement === element.parentElement?.querySelector(`.scroll-edge--${edge} button`)) element.focus({ preventScroll: true });
      }
      setEdges(previous => previous.left === left && previous.right === right ? previous : { left, right });
    };
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    if (element.firstElementChild) observer.observe(element.firstElementChild);
    element.addEventListener("scroll", measure, { passive: true });
    window.addEventListener("resize", measure);
    measure();
    return () => { observer.disconnect(); element.removeEventListener("scroll", measure); window.removeEventListener("resize", measure); };
  }, [children]);
  function move(direction: number) {
    const element = scroller.current;
    if (!element) return;
    element.scrollBy({ left: direction * element.clientWidth * 0.75, behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
  }
  return <div className="horizontal-scroll-hints">
    <div ref={scroller} className={className} role="region" aria-label={label} tabIndex={0}>{children}</div>
    {(["left", "right"] as const).map(edge => edges[edge] && <div key={edge} className={`scroll-edge scroll-edge--${edge}`}><button type="button" onClick={() => move(edge === "left" ? -1 : 1)} aria-label={edge === "left" ? "Vezi coloanele din stânga" : "Vezi coloanele din dreapta"}><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><path d={edge === "left" ? "m15 6-6 6 6 6" : "m9 6 6 6-6 6"} /></svg></button></div>)}
  </div>;
}
