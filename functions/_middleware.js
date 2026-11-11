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
// Cloudflare Web Analytics (cookie-free visit counts, decision of 19 Oct 2026):
// the beacon loads from static.cloudflareinsights.com and reports to
// cloudflareinsights.com. Both must stay in step with _headers in build.js.
const CF_BEACON_SCRIPT = 'https://static.cloudflareinsights.com';
const CF_BEACON_REPORT = 'https://cloudflareinsights.com';

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
    `script-src 'self' 'nonce-${nonce}' ${CF_BEACON_SCRIPT}`,
    "style-src 'self' 'unsafe-inline'",
    "font-src 'self'",
    `img-src 'self' data: ${R2_PUBLIC} https://api.qrserver.com`,
    `media-src 'self' ${R2_PUBLIC}`,
    `connect-src 'self' ${CF_BEACON_REPORT}`,
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "object-src 'none'",
  ].join('; ');
}

// ---------------------------------------------------------------------------
// BY INVITATION ONLY (11 Nov 2026, Howard: "Please put the website behind a
// "By invitation only" placeholder page, which requests a code. Don't create
// any codes, just do this - this project is on hold until Jan soonest.")
//
// Every page asks for an invitation code first. Codes live in the Pages
// environment variable INVITE_CODES (comma-separated); none is set, so no code
// opens the site until one is added in the Cloudflare dashboard. A right code
// sets pb_invite = sha256 of the code (HttpOnly, 30 days), checked against the
// list on every request, so removing a code shuts its holders out again.
//
// Left open on purpose: the legal pages (privacy, terms, cookies), fonts and
// images the holding page needs, robots.txt, and /issues (residents report
// faults through it). The portal is a different host and is not touched; the
// holding page links its generic sign-in, which names no block.
// ---------------------------------------------------------------------------
const INVITE_COOKIE = 'pb_invite';
const OPEN_PATHS = [/^\/(privacy|terms|cookies)(\/|$)/, /^\/(fonts|img|brand)\//, /^\/robots\.txt$/, /^\/issues\/?$/];

async function sha256Hex(s) {
  const d = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s));
  return [...new Uint8Array(d)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

function inviteCodes(env) {
  return String((env && env.INVITE_CODES) || '').split(',').map((c) => c.trim().toUpperCase()).filter((c) => c.length >= 8);
}

async function holdsInvite(request, env) {
  const codes = inviteCodes(env);
  if (!codes.length) return false;
  const m = (request.headers.get('cookie') || '').match(/(?:^|;\s*)pb_invite=([a-f0-9]{64})/);
  if (!m) return false;
  for (const c of codes) if ((await sha256Hex(c)) === m[1]) return true;
  return false;
}

const escHtml = (s) => String(s).replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));

function holdingPage(next, error, value) {
  return `<!doctype html>
<html lang="en-GB">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex">
<title>By invitation only - Proper Blocks</title>
<link rel="icon" type="image/png" href="/img/pb-mark-64.png">
<link rel="stylesheet" href="/fonts/fonts-1.css">
<style>
:root{--bg:#FAF9F6;--panel:#FFFFFF;--ink:#1E293B;--muted:#55606E;--rule:#E6E3DC;--copper:#1F8E99;--copper-deep:#155F66;--r-lg:14px;--r-pill:999px}
*{box-sizing:border-box}
html,body{margin:0;background:var(--bg);color:var(--ink);font-family:'Inter',system-ui,-apple-system,'Segoe UI',sans-serif;font-size:16px;line-height:1.55}
main{min-height:100vh;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:32px 20px}
.card{width:100%;max-width:440px;background:var(--panel);border:1px solid var(--rule);border-radius:var(--r-lg);padding:36px 32px;text-align:center}
.mark{width:48px;height:48px;display:block;margin:0 auto 14px}
.brand{font-family:'Fraunces',Georgia,serif;font-size:22px;font-weight:600;margin:0 0 22px}
h1{font-family:'Fraunces',Georgia,serif;font-size:30px;line-height:1.2;font-weight:600;margin:0 0 10px}
p.lede{color:var(--muted);margin:0 0 24px}
form{text-align:left}
label{display:block;font-weight:600;font-size:14px;margin-bottom:6px}
input{width:100%;font:inherit;font-size:18px;letter-spacing:.06em;padding:12px 14px;border:1px solid #C9C4BA;border-radius:10px;background:#fff;color:var(--ink)}
input:focus{outline:3px solid #CDF4F8;border-color:var(--copper)}
button{margin-top:14px;width:100%;min-height:48px;font:inherit;font-weight:600;color:#fff;background:var(--copper-deep);border:0;border-radius:var(--r-pill);cursor:pointer}
button:hover{background:#103E43}
.err{color:#D94A3D;font-weight:600;font-size:14px;margin:10px 0 0}
.resident{margin:22px 0 0;font-size:14px;color:var(--muted)}
.resident a,footer a{color:var(--copper-deep)}
footer{margin-top:28px;text-align:center;font-size:13px;color:var(--muted)}
footer .links{margin-top:6px;display:flex;gap:14px;justify-content:center;flex-wrap:wrap}
.tpo{display:block;margin:18px auto 0}
</style>
</head>
<body>
<main>
  <div class="card">
    <img class="mark" src="/img/pb-mark-64.png" alt="" width="48" height="48">
    <p class="brand">Proper Blocks</p>
    <h1>By invitation only</h1>
    <p class="lede">If you have been given an invitation code, enter it below.</p>
    <form method="post" action="/invite" novalidate>
      <input type="hidden" name="next" value="${escHtml(next)}">
      <label for="code">Invitation code</label>
      <input id="code" name="code" type="text" autocomplete="off" autocapitalize="characters" spellcheck="false" maxlength="64" value="${escHtml(value || '')}" required${error ? ' aria-invalid="true" aria-describedby="code-err"' : ''} autofocus>
      ${error ? `<p class="err" id="code-err" role="alert">&#9888; ${escHtml(error)}</p>` : ''}
      <button type="submit">Continue</button>
    </form>
    <p class="resident">Already have an account? <a href="https://portal.properblocks.co.uk/">Sign in</a></p>
  </div>
  <footer>
    <div>&copy; 2026 Proper Blocks Ltd &middot; Co. No. 17301605 &middot; Registered in England &amp; Wales</div>
    <div class="links"><a href="/privacy/">Privacy</a><a href="/terms/">Terms</a><a href="/cookies/">Cookies</a></div>
    <a class="tpo" href="https://www.tpos.co.uk/business-search/proper-blocks/" target="_blank" rel="noopener noreferrer" aria-label="The Property Ombudsman, membership T14754: our entry on their public member register, opens in a new tab"><img src="/img/the-property-ombudsman.webp" alt="The Property Ombudsman" width="126" height="44"></a>
  </footer>
</main>
</body>
</html>`;
}

function holdingResponse(next, error, status, value) {
  return new Response(holdingPage(next, error, value), {
    status: status || 200,
    headers: {
      'content-type': 'text/html; charset=utf-8',
      'cache-control': 'no-store',
      'x-robots-tag': 'noindex',
      'Content-Security-Policy': buildCsp(randomNonce()),
      'X-Frame-Options': 'DENY',
      'X-Content-Type-Options': 'nosniff',
      'Referrer-Policy': 'strict-origin-when-cross-origin',
      'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
    },
  });
}

// Only a same-site path is ever followed after the code, never another host.
function safeNext(v) {
  const s = String(v || '/');
  return /^\/(?!\/)[^\s\\]*$/.test(s) ? s : '/';
}

async function inviteGate(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  if (url.pathname === '/invite' && request.method === 'POST') {
    const form = await request.formData().catch(() => null);
    const code = String((form && form.get('code')) || '').trim().toUpperCase().slice(0, 64);
    const next = safeNext(form && form.get('next'));
    if (!code) return holdingResponse(next, 'Enter your invitation code.', 400);
    if (!inviteCodes(env).includes(code)) return holdingResponse(next, "That code isn't recognised. Check it and try again.", 403, code);
    return new Response(null, {
      status: 303,
      headers: {
        location: next,
        'set-cookie': `${INVITE_COOKIE}=${await sha256Hex(code)}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${30 * 24 * 3600}`,
        'cache-control': 'no-store',
      },
    });
  }
  if (OPEN_PATHS.some((re) => re.test(url.pathname))) return null;
  if (await holdsInvite(request, env)) return null;
  return holdingResponse(url.pathname + url.search, '', 200);
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

  const gated = await inviteGate(context);
  if (gated) return gated;

  const response = await context.next();

  // Bail early for non-HTML responses - they get the static CSP from _headers.
  const contentType = response.headers.get('content-type') || '';
  if (!contentType.toLowerCase().includes('text/html')) {
    return response;
  }

  const nonce = randomNonce();

  // Inject nonce attribute on every inline <script> (not on external scripts
  // - they pass via script-src 'self' or, for the analytics beacon, the
  // CF_BEACON_SCRIPT host). The CSP authorises only inline scripts
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
