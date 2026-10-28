"use client";
import { useEffect, useRef, useState, type ReactNode } from "react";

export function HorizontalScrollHints({ children, className, label }: { children: ReactNode; className: string; label: string }) {
  const scroller = useRef<HTMLDivElement>(null);
  const [scroll, setScroll] = useState({ overflow: false, left: false, right: false, position: 0, fraction: 1 });
  useEffect(() => {
    const element = scroller.current;
    if (!element) return;
    const measure = () => {
      const maximum = element.scrollWidth - element.clientWidth;
      const overflow = /auto|scroll/.test(getComputedStyle(element).overflowX) && maximum > 2;
      const position = overflow ? Math.max(0, Math.min(1, element.scrollLeft / maximum)) : 0;
      const next = { overflow, left: overflow && element.scrollLeft > 2, right: overflow && maximum - element.scrollLeft > 2, position, fraction: overflow ? element.clientWidth / element.scrollWidth : 1 };
      if (!overflow && element.parentElement?.querySelector(".table-scroll-bar")?.contains(document.activeElement)) element.focus({ preventScroll: true });
      setScroll(previous => Object.keys(next).every(key => previous[key as keyof typeof next] === next[key as keyof typeof next]) ? previous : next);
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
    element.scrollTo({ left: direction < 0 ? 0 : element.scrollWidth - element.clientWidth, behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
  }
  return <div className="horizontal-scroll-hints">
    {scroll.overflow && <div className="table-scroll-bar" role="group" aria-label={`Derulare: ${label}`}>
      <button className="table-scroll-left" type="button" disabled={!scroll.left} onClick={() => move(-1)} aria-label="Mergi la începutul tabelului"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><path d="m15 6-6 6 6 6" /></svg></button>
      <div className="table-scroll-track" aria-hidden="true"><span style={{ width: `${scroll.fraction * 100}%`, left: `${scroll.position * (1 - scroll.fraction) * 100}%` }} /></div>
      <button className="table-scroll-right" type="button" disabled={!scroll.right} onClick={() => move(1)} aria-label="Mergi la capătul tabelului"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><path d="m9 6 6 6-6 6" /></svg></button>
    </div>}
    <div ref={scroller} className={className} role="region" aria-label={label} tabIndex={0}>{children}</div>
  </div>;
}
