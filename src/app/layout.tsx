import type { Metadata } from "next";
import "./globals.css";
import { EntryModalStateProvider } from "./entry-modal-state";

export const metadata: Metadata = { title: "KAJA — Platformă internă", description: "Spațiu de lucru pentru membri" };

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body><EntryModalStateProvider>{children}</EntryModalStateProvider></body></html>;
}
