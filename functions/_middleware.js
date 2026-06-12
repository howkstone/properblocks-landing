// Per-request CSP nonce middleware for properblocks-landing Pages project.
//
// Closes CTO finding F-PBL-23-002 (Pages CSP weakens to 'unsafe-inline'):
// pre-cutover the DH Worker serves the apex with a per-response nonce; the
// _headers static file cannot inject per-response nonces, so without this
// middleware the Pages CSP relaxes to 'unsafe-inline' on every script.
// This middleware generates a 128-bit nonce per request, injects it into
// every inline <script> tag via HTMLRewriter, and rewrites the CSP header
// to authorise that single nonce. Result: no 'unsafe-inline' for script.
//
// Non-HTML responses (robots.txt, llms.txt, sitemap.xml, brand assets) bypass
// the rewriter and inherit the CSP from _headers, which is already tight.
//
// Style-src keeps 'unsafe-inline' deliberately - the design uses ~280 lines
// of inline <style> (cheaper than a separate stylesheet round-trip on a
// single-page landing). All inline event handlers in the HTML have been
// audited and replaced with addEventListener (see ui/landing.js line ~470
// onwards), so script-src does not need 'unsafe-hashes' either.
//
// CSP additions vs _headers:
//   - img-src + media-src now allow the R2 public bucket (hero morph video
//     + logo are served from pub-db98ca8cff464d5a815f4823cbb00748.r2.dev).
//     Pre-this-middleware the morph video would silently fail CSP after
//     cutover because default-src 'self' did not include the R2 origin.
//   - frame-ancestors 'none', base-uri 'self', object-src 'none' added
//     defence-in-depth.

const R2_PUBLIC = 'https://pub-db98ca8cff464d5a815f4823cbb00748.r2.dev';

function randomNonce() {
  // 16 bytes = 128 bits of entropy. Base64-encoded, strip padding for the
  // CSP token (CSP nonce is just an opaque string; padding is fine but ugly).
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/=+$/, '');
}

function buildCsp(nonce) {
  return [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}'`,
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "font-src https://fonts.gstatic.com",
    `img-src 'self' data: ${R2_PUBLIC} https://api.qrserver.com`,
    `media-src 'self' ${R2_PUBLIC}`,
    "connect-src 'self'",
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "object-src 'none'",
  ].join('; ');
}

export async function onRequest(context) {
  // www -> apex canonical 301. The _redirects file format on Pages only
  // supports path-based source rules, not cross-host, so this redirect lives
  // here in the middleware instead. Added 2026-05-26 after cutover, when www
  // started serving content directly alongside apex (which is bad for SEO
  // canonical signalling and breaks the canonical link tag in the HTML).
  const reqUrl = new URL(context.request.url);
  if (reqUrl.host === 'www.properblocks.co.uk') {
    reqUrl.host = 'properblocks.co.uk';
    return Response.redirect(reqUrl.toString(), 301);
  }

  // properblocks.co.uk/issues -> the public issue-reporting form, which is
  // served by the portal Worker (it needs the database + photo storage).
  // The brand URL people see stays properblocks.co.uk/issues. 302 (not 301)
  // so it can be repointed instantly if the form ever moves.
  if (reqUrl.pathname === '/issues' || reqUrl.pathname === '/issues/') {
    return Response.redirect('https://dennishouse.properblocks.co.uk/issues', 302);
  }

  const response = await context.next();

  // Bail early for non-HTML responses - they get the static CSP from _headers.
  const contentType = response.headers.get('content-type') || '';
  if (!contentType.toLowerCase().includes('text/html')) {
    return response;
  }

  const nonce = randomNonce();

  // Inject nonce attribute on every inline <script> (not on external scripts
  // - they pass via script-src 'self'). The CSP authorises only inline scripts
  // carrying the matching nonce; without it the inline block would fail.
  const rewriter = new HTMLRewriter().on('script', {
    element(el) {
      if (!el.hasAttribute('src')) {
        el.setAttribute('nonce', nonce);
      }
    },
  });

  const transformed = rewriter.transform(response);

  // HTMLRewriter returns a new Response sharing the original's headers map.
  // Overwrite the CSP header to authorise the per-request nonce.
  transformed.headers.set('Content-Security-Policy', buildCsp(nonce));

  return transformed;
}
