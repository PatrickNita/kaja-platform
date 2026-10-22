"use client";
import type { ReactNode } from "react";
import type { FeedbackHistoryRow } from "../../lib/feedback-history";
import { feedbackBrands } from "../../lib/feedback-model";
import { ConfirmDialog } from "../b2b/ui";
import { NavigationIcon } from "../navigation-icon";

const dateFormat = new Intl.DateTimeFormat("ro-RO", {
  dateStyle: "medium", timeStyle: "short", timeZone: "Europe/Chisinau",
});

export function FeedbackMessageDialog({ message, onClose, children }: {
  message: Pick<FeedbackHistoryRow, "product" | "brand" | "flavor" | "body" | "createdAt">;
  onClose: () => void;
  children?: ReactNode;
}) {
  const brand = feedbackBrands.find(b => b.key === message.brand)?.label ?? message.brand;
  const received = dateFormat.format(new Date(message.createdAt));
  return <ConfirmDialog title={`Feedback primit la ${received}`} titleContent={<span className="feedback-message-heading">Feedback primit la <time dateTime={message.createdAt}>{received}</time></span>} busy={false} onClose={onClose} className="feedback-message-dialog">
    <div className="feedback-message-product">
      <h4>{message.product}</h4>
      {message.flavor && <span className="feedback-message-flavor">{message.flavor}</span>}
      <span className="feedback-message-brand">{brand}</span>
    </div>
    <section className="feedback-message-body" aria-label="Comentariu anonim">
      <NavigationIcon name="feedback" />
      <p>{message.body}</p>
    </section>
    {children}
  </ConfirmDialog>;
}
