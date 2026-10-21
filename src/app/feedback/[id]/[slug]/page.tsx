import { readPublicLanguage } from "../../../../lib/public-language-server";
import Image from "next/image";
import type { Metadata } from "next";
import { publicFeedbackProductBySlug } from "../../../../lib/feedback-server";
import { feedbackChallenge } from "../../../../lib/feedback-security";
import { PublicFeedbackForm } from "../../public-form";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Feedback produs", description: "Lasă un comentariu anonim despre produs.", robots: { index: false, follow: false }, referrer: "no-referrer" };
export default async function ProductFeedbackPage({ params }: { params: Promise<{ id: string; slug: string }> }) {
  const { id: brand, slug } = await params;
  const language = await readPublicLanguage();
  const product = await publicFeedbackProductBySlug(brand, slug);
  return <main className="public-feedback">{!product && <Image className="logo" src="/kaja-logo.png" alt="KAJA" width={1024} height={240} priority />}{product ? <PublicFeedbackForm initialLanguage={language} product={product} challenge={feedbackChallenge(product.id)} /> : <section className="item"><h1>Produs indisponibil / Товар недоступен</h1><p>Acest link nu mai acceptă feedback.<br />По этой ссылке больше нельзя оставить отзыв.</p></section>}</main>;
}
