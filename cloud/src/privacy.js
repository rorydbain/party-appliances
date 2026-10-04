const escape = value => String(value).replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]);

export function privacyBody(env = {}) {
  const contact = String(env.PRIVACY_CONTACT || '').trim();
  const contactLine = contact ? `<p>For privacy questions or to request removal of a photograph, contact ${escape(contact)}.</p>` : '<p>Ask the event host if you would like a photograph removed.</p>';
  return `${contactLine}
<h2>Photographs</h2>
<p>This gallery stores the finished photographs uploaded by the event photo booth. Anyone with the event gallery address may be able to view and download them. The booth keeps its camera originals locally; it does not upload them.</p>
<h2>Hosting</h2>
<p>Cloudflare Workers serves this website and Cloudflare R2 stores the photographs. Hosting providers receive ordinary request information, including IP addresses and browser headers, to deliver and secure the service. This gallery does not include analytics, advertising trackers or tracking cookies.</p>
<h2>Administration</h2>
<p>The event host can delete photographs through the protected administration page. Its sign-in cookie is used only for that session.</p>`;
}
