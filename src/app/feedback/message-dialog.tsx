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
  return <ConfirmDialog title="Feedback primit" titleContent={<span className="feedback-message-heading"><NavigationIcon name="feedback" />Feedback primit</span>} busy={false} onClose={onClose} className="feedback-message-dialog">
    <div className="feedback-message-product">
      <h4>{message.product}<span className="feedback-message-brand">{brand}</span></h4>
      {message.flavor && <p>{message.flavor}</p>}
    </div>
    <dl className="feedback-message-received"><dt>Primit la</dt><dd><time dateTime={message.createdAt}>{dateFormat.format(new Date(message.createdAt))}</time></dd></dl>
    <section className="feedback-message-body" aria-label="Comentariu anonim">
      <h4>Comentariu anonim</h4>
      <p>{message.body}</p>
    </section>
    {children}
  </ConfirmDialog>;
}
