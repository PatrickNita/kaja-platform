"use client";
import { useEffect, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { FilterSelect } from "./b2b/filter-select";
import { ProductPlaceholder } from "./design-primitives";
import { normalizeProductSort, productListSortOptions } from "../lib/product-list-sort";
import { SearchField } from "./design-primitives";
import { WorkspaceListToolbar } from "./workspace-list-toolbar";
import { CatalogueAddButton } from "./catalogue-composer";

export function ProductListSort({ catalogue = false, canCreate=false }: { catalogue?: boolean; canCreate?:boolean }) {
  const params=useSearchParams(),router=useRouter(),pathname=usePathname();
  const usage=catalogue && params.get("brand") === "kaja" && (params.get("catalogue") ?? "live") === "live";
  const requested=params.get("sort"),value=normalizeProductSort(requested,usage);
  const urlQuery=params.get("q") ?? "";
  const [search,setSearch]=useState(urlQuery),timer=useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(()=>{setSearch(urlQuery);},[urlQuery]);
  useEffect(()=>()=>{if(timer.current)clearTimeout(timer.current);},[]);
  function updateSearch(next:string) {
    setSearch(next);
    if(timer.current)clearTimeout(timer.current);
    timer.current=setTimeout(()=>{
      timer.current=null;
      const url=new URL(window.location.href);
      if(next.trim())url.searchParams.set("q",next.trim());else url.searchParams.delete("q");
      url.hash="";
      router.replace(url.pathname+url.search,{scroll:false});
    },250);
  }
  useEffect(() => {
    if (!requested || requested === value) return;
    const query=new URLSearchParams(params.toString());query.set("sort",value);
    router.replace(`${pathname}?${query}`,{scroll:false});
  },[requested,value,params,pathname,router]);
  return <WorkspaceListToolbar><SearchField aria-label="Caută produse" placeholder="Caută produs sau gust…" value={search} onChange={event=>updateSearch(event.target.value)} /><FilterSelect label="Sortare produse" value={value} options={productListSortOptions.filter(option=>usage||option.value.startsWith("name-"))} onChange={next=>{if(timer.current)clearTimeout(timer.current);const query=new URLSearchParams(params.toString());query.set("sort",next);if(search.trim())query.set("q",search.trim());else query.delete("q");router.push(`${pathname}?${query}`,{scroll:false});}} />{catalogue && canCreate && <CatalogueAddButton />}</WorkspaceListToolbar>;
}

export function ProductListThumbnail({ imageId, title }: { imageId?:number; title:string }) {
  const [failedImage,setFailedImage]=useState<number>();
  const image=useRef<HTMLImageElement>(null);
  useEffect(()=>{if (image.current?.complete && !image.current.naturalWidth) setFailedImage(imageId);},[imageId]);
  return <span className="product-list-thumbnail">{imageId && failedImage !== imageId ? <img ref={image} src={`/api/item-images/${imageId}`} alt={`Previzualizare ${title}`} loading="lazy" onError={()=>setFailedImage(imageId)} /> : <ProductPlaceholder />}</span>;
}
