import { phoneHref } from "../../lib/b2b/contact";

export function ContactPhone({ value, className }: { value: string; className?: string }) {
  const href = phoneHref(value);
  return href ? <a className={className} href={href}>{value}</a> : <span className={className}>{value || "—"}</span>;
}
