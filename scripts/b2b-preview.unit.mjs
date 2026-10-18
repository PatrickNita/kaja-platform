import assert from "node:assert/strict";
import { isLinkPreview, previewHtml } from "../src/lib/b2b/preview.ts";
for (const ua of [
  "TelegramBot (like TwitterBot)",
  "WhatsApp/2.0",
  "facebookexternalhit/1.1",
  "Twitterbot/1.0",
  "Slackbot-LinkExpanding",
  "Discordbot",
])
  assert(isLinkPreview(ua));
assert(!isLinkPreview("Mozilla/5.0 Chrome/130.0"));
assert(!isLinkPreview(""));
const html = previewHtml(["IMPERATOR", "KAMORA PRIVATE", "KAMORA VIBE"]);
assert(
  html.includes('content="KAJA - IMPERATOR, KAMORA PRIVATE, KAMORA VIBE"'),
);
assert(html.includes('content="Link pentru comenzi"'));
assert(!html.includes("Spațiu de lucru pentru membri"));
const unsafe = previewHtml(['<script>alert("x")</script> & bar']);
assert(!unsafe.includes("<script>"));
assert(unsafe.includes("&lt;script&gt;"));
assert(unsafe.includes("&quot;"));
assert(unsafe.includes("&amp;"));
console.log(
  "PASS: link preview metadata, messaging crawlers and HTML escaping.",
);
