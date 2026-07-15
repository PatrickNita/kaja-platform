import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = { title: "KAJA — Platformă internă", description: "Spațiu de lucru pentru membri" };

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}
