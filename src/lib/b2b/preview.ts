// Link unfurlers need HTML metadata; human visitors keep the authenticated redirect.
export function isLinkPreview(userAgent: string) {
  return /TelegramBot|WhatsApp|facebookexternalhit|Facebot|Twitterbot|LinkedInBot|Slackbot|Discordbot|Viber|SkypeUriPreview|vkShare|Pinterestbot/i.test(
    userAgent,
  );
}
export function previewHtml(names: string[]) {
  const escape = (value: string) =>
    value.replace(
      /[&<>"']/g,
      (c) =>
        ({
          "&": "&amp;",
          "<": "&lt;",
          ">": "&gt;",
          '"': "&quot;",
          "'": "&#39;",
        })[c]!,
    );
  const title = escape("KAJA - " + names.join(", "));
  const description = "Link pentru comenzi";
  return `<!doctype html><html lang="ro"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${title}</title><meta name="description" content="${description}"><meta property="og:type" content="website"><meta property="og:site_name" content="KAJA"><meta property="og:title" content="${title}"><meta property="og:description" content="${description}"><meta name="twitter:card" content="summary"><meta name="twitter:title" content="${title}"><meta name="twitter:description" content="${description}"><meta name="robots" content="noindex, nofollow"><meta name="referrer" content="no-referrer"></head><body><h1>${title}</h1><p>${description}</p></body></html>`;
}
