import Image from "next/image";
import { permanentRedirect } from "next/navigation";
import { feedbackPath } from "../../../lib/feedback-model";
import type { Metadata } from "next";
import { publicFeedbackProduct } from "../../../lib/feedback-server";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Feedback produs", description: "Lasă un comentariu anonim despre produs.", robots: { index: false, follow: false }, referrer: "no-referrer" };
export default async function PublicFeedback({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const product = await publicFeedbackProduct(id);
  if (product) permanentRedirect(feedbackPath(product));
  return <main className="public-feedback"><Image className="logo" src="/kaja-logo.png" alt="KAJA" width={1024} height={240} priority /><section className="item"><h1>Produs indisponibil / Товар недоступен</h1><p>Acest link nu mai acceptă feedback.<br />По этой ссылке больше нельзя оставить отзыв.</p></section></main>;
}
