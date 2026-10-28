"use client";
import { useEffect, useRef, useState } from "react";
import { NavigationIcon } from "./navigation-icon";

export function ProductImage({ imageId, name, className = "" }: { imageId?: number | null; name: string; className?: string }) {
  const [failed, setFailed] = useState<number | null>(null);
  const image = useRef<HTMLImageElement>(null);
  useEffect(() => {
    if (image.current?.complete && !image.current.naturalWidth) setFailed(imageId ?? null);
  }, [imageId]);
  const visible = Boolean(imageId && failed !== imageId);
  return <span className={`product-placeholder product-image${visible ? " has-product-image" : ""} ${className}`}>
    {visible ? <img ref={image} src={`/api/product-images/${imageId}`} alt={name} loading="lazy" onError={() => setFailed(imageId ?? null)} /> : <NavigationIcon name="product" />}
  </span>;
}
