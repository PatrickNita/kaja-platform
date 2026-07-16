"use client";

import type { ComponentProps } from "react";
import { useEffect, useRef } from "react";

type Props = ComponentProps<"textarea">;

export function AutoResizeTextarea({ className, onInput, rows = 1, ...props }: Props) {
  const ref = useRef<HTMLTextAreaElement>(null);

  const resize = () => {
    if (!ref.current) return;
    ref.current.style.height = "auto";
    ref.current.style.height = `${Math.max(48, ref.current.scrollHeight)}px`;
  };

  useEffect(resize, [props.defaultValue, props.value]);

  const handleInput: NonNullable<Props["onInput"]> = (event) => {
    resize();
    onInput?.(event);
  };

  return <textarea ref={ref} className={`auto-resize-textarea${className ? ` ${className}` : ""}`} rows={rows} onInput={handleInput} {...props} />;
}

export function CommentTextarea() {
  return <AutoResizeTextarea name="body" required maxLength={1000} placeholder="Scrie un comentariu" />;
}
