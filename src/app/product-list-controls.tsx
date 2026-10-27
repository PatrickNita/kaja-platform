"use client";
import { useEffect, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { FilterSelect } from "./b2b/filter-select";
import { ProductPlaceholder } from "./design-primitives";
import { normalizeProductSort, productListSortOptions } from "../lib/product-list-sort";

export function ProductListSort({ catalogue = false }: { catalogue?: boolean }) {
  const params=useSearchParams(),router=useRouter(),pathname=usePathname();
  const usage=catalogue && params.get("brand") === "kaja" && (params.get("catalogue") ?? "live") === "live";
  const requested=params.get("sort"),value=normalizeProductSort(requested,usage);
  useEffect(() => {
    if (!requested || requested === value) return;
    const query=new URLSearchParams(params.toString());query.set("sort",value);
    router.replace(`${pathname}?${query}`,{scroll:false});
  },[requested,value,params,pathname,router]);
  return <div className="product-list-toolbar"><FilterSelect label="Sortare produse" value={value} options={productListSortOptions.filter(option=>usage||option.value.startsWith("name-"))} onChange={next=>{const query=new URLSearchParams(params.toString());query.set("sort",next);router.push(`${pathname}?${query}`,{scroll:false});}} /></div>;
}

export function ProductListThumbnail({ imageId, title }: { imageId?:number; title:string }) {
  const [failedImage,setFailedImage]=useState<number>();
  const image=useRef<HTMLImageElement>(null);
  useEffect(()=>{if (image.current?.complete && !image.current.naturalWidth) setFailedImage(imageId);},[imageId]);
  return <span className="product-list-thumbnail">{imageId && failedImage !== imageId ? <img ref={image} src={`/api/item-images/${imageId}`} alt={`Previzualizare ${title}`} loading="lazy" onError={()=>setFailedImage(imageId)} /> : <ProductPlaceholder />}</span>;
}
