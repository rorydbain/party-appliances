const escape = value => String(value).replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]);

export function privacyBody(env = {}) {
  const contact = String(env.PRIVACY_CONTACT || '').trim();
  const contactLine = contact ? `<p>For privacy questions or to request removal of a photograph, contact ${escape(contact)}.</p>` : '<p>Ask the event host if you would like a photograph removed.</p>';
  return `${contactLine}
<h2>Photographs</h2>
<p>This gallery stores finished photographs from the event photo booth and photographs deliberately contributed through the shared upload page. Anyone with the gallery address may view and download them. The photo booth keeps its camera originals locally; guest uploads are stored in the form submitted by the upload page.</p>
<h2>Hosting</h2>
<p>Cloudflare Workers serves this website and Cloudflare R2 stores the photographs. Hosting providers receive ordinary request information, including IP addresses and browser headers, to deliver and secure the service. This gallery does not include analytics, advertising trackers or tracking cookies.</p>
<h2>Guest uploads</h2>
<p>The shared passcode does not create an account and is kept only for the current browser session. File names are not displayed publicly. Only upload photographs you are comfortable sharing with everyone who has the gallery address.</p>
<h2>Administration</h2>
<p>The event host can delete photographs through the protected administration page. Its sign-in cookie is used only for that session.</p>`;
}
