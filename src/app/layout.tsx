import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = { title: "KAJA — Internal", description: "KAJA member workspace" };

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}
