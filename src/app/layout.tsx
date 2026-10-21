import type { Metadata } from "next";
import "./globals.css";
import "./design-system.css";
import { EntryModalStateProvider } from "./entry-modal-state";
import { currentMember } from "../lib/auth";

export const metadata: Metadata = { title: "KAJA — Platformă internă", description: "Spațiu de lucru pentru membri" };

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const member = await currentMember();
  return <html lang="ro"><body><EntryModalStateProvider memberSlug={member?.slug ?? "guest"}>{children}</EntryModalStateProvider></body></html>;
}
