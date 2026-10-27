"use client";
import { createContext, useContext, useEffect, useRef, useState, type ReactNode, type RefObject } from "react";

const Context=createContext<{open:boolean;setOpen:(open:boolean)=>void;trigger:RefObject<HTMLButtonElement|null>} | null>(null);
export function CatalogueComposerProvider({ children }: { children:ReactNode }) {
  const [open,setOpen]=useState(false),trigger=useRef<HTMLButtonElement>(null);
  useEffect(()=>{const close=()=>setOpen(false);window.addEventListener("workspace-filter-change",close);return()=>window.removeEventListener("workspace-filter-change",close);},[]);
  return <Context.Provider value={{open,setOpen,trigger}}>{children}</Context.Provider>;
}
export function CatalogueAddButton({ mobile=false }: { mobile?:boolean }) {
  const state=useContext(Context);
  if (!state) return null;
  return <button type="button" className={`button ${mobile ? "b2b-add-mobile" : "b2b-add-desktop"}`} aria-controls="catalogue-composer" aria-expanded={state.open} onClick={event=>{state.trigger.current=event.currentTarget;state.setOpen(!state.open);}}>Adaugă produs nou</button>;
}
export function CatalogueComposer({ children }: { children:ReactNode }) {
  const state=useContext(Context);
  if (!state) return null;
  return <details id="catalogue-composer" className="composer-toggle catalogue-composer" open={state.open} onToggle={event=>{if(event.currentTarget.open!==state.open)state.setOpen(event.currentTarget.open);}}>
    <summary hidden>Adaugă produs nou</summary>
    <div className="composer-content">{children}<button type="button" className="button ghost" onClick={()=>{state.setOpen(false);requestAnimationFrame(()=>state.trigger.current?.focus({preventScroll:true}));}}>Închide</button></div>
  </details>;
}
