"use client";

import { useEffect, useRef } from "react";

export function CommentTextarea() {
  const ref = useRef<HTMLTextAreaElement>(null);

  const resize = () => {
    if (!ref.current) return;
    ref.current.style.height = "auto";
    ref.current.style.height = `${Math.max(48, ref.current.scrollHeight)}px`;
  };

  useEffect(resize, []);

  return <textarea ref={ref} name="body" required maxLength={1000} rows={1} placeholder="Scrie un comentariu" onInput={resize} />;
}
