#!/usr/bin/env node
// One-shot build script: convert the DH Worker's ui/*.js modules into static HTML
// for the standalone Pages project. Reads the four landing UI modules and the
// shared policy CSS, strips the JS module wrapper, inlines CSS, fixes regex
// double-escapes, and writes static .html files next to this script.
//
// Run once: `node build.js`
// Re-run if landing.js / privacy.js / cookies.js / terms.js change in the DH
// repo. (Long-term you can delete this script; the static files are the
// canonical source for the Pages site from then on.)

const fs = require('fs');
const path = require('path');

const DH = path.join('C:', 'Users', 'user', 'dennis-house-portal', 'ui');
const OUT = __dirname;

// R2 public bucket for landing brand assets (separate from dennis-house-docs,
// which holds private documents and D1 backups - that bucket MUST stay private).
// Bucket: properblocks-public. Enabled via `wrangler r2 bucket dev-url enable`.
const R2_PUBLIC_BASE = 'https://pub-db98ca8cff464d5a815f4823cbb00748.r2.dev';

function rewriteBrandPaths(html) {
  // Pages does not host the 7MB morph.mp4 (GitHub HTTP push timeout class).
  // Replace any /brand/morph.mp4(?v=N) reference with the R2 public URL.
  return html
    .replace(/\/brand\/morph\.mp4(\?v=\d+)?/g, `${R2_PUBLIC_BASE}/morph.mp4`)
    .replace(/\/brand\/buildings\.jpg(\?v=\d+)?/g, `${R2_PUBLIC_BASE}/buildings.jpg`);
}

function readModuleTemplate(file) {
  // Reads a ui/*.js file and returns the contents of its `export default` template literal.
  const src = fs.readFileSync(path.join(DH, file), 'utf8');
  const m = src.match(/export\s+default\s+`([\s\S]*)`\s*;?\s*$/);
  if (!m) throw new Error(`could not extract template literal from ${file}`);
  // Template literals interpret `\\` as a single backslash. Reverse that for static HTML.
  return m[1].replace(/\\\\/g, '\\').replace(/\\`/g, '`').replace(/\\\$/g, '$');
}

function readPolicyCss() {
  const src = fs.readFileSync(path.join(DH, '_policy-css.js'), 'utf8');
  const m = src.match(/export\s+default\s+`([\s\S]*)`\s*;?\s*$/);
  if (!m) throw new Error('could not extract policy CSS');
  return m[1];
}

function inlinePolicyCss(html, css) {
  // Privacy/cookies/terms modules use `${POLICY_PAGE_CSS}` or `${POLICY_CSS}`
  // template-literal interpolation. After our regex extract those tokens are
  // present as literal text. Replace with the actual CSS.
  return html.replace(/\$\{POLICY_PAGE_CSS\}/g, css).replace(/\$\{POLICY_CSS\}/g, css);
}

const policyCss = readPolicyCss();

const landing = rewriteBrandPaths(readModuleTemplate('landing.js'));
const privacy = inlinePolicyCss(readModuleTemplate('privacy.js'), policyCss);
const cookies = inlinePolicyCss(readModuleTemplate('cookies.js'), policyCss);
const terms   = inlinePolicyCss(readModuleTemplate('terms.js'),   policyCss);

fs.writeFileSync(path.join(OUT, 'index.html'),         landing);
fs.writeFileSync(path.join(OUT, 'privacy', 'index.html'), privacy);
fs.writeFileSync(path.join(OUT, 'cookies', 'index.html'), cookies);
fs.writeFileSync(path.join(OUT, 'terms',   'index.html'), terms);

// ---- Shared page chrome -------------------------------------------------
// The home page is the master. Every other page carries the same header and
// the same footer, so a visitor gets the same navigation wherever they land
// and every page links to every other one. That second part is the reason
// this exists: an orphan page (no internal links pointing at it) is crawled
// less often and inherits none of the site's authority, so a page nobody can
// navigate to is a page that ranks weakly. Hand-editing a page's header is
// pointless - this rewrites it on every build.
const MARK_SVG = '<svg viewBox="0 0 32 32"><rect x="3" y="16" width="11" height="13" rx="1" fill="#4DDBE8"/><rect x="18" y="16" width="11" height="13" rx="1" fill="#1F8E99"/><rect x="10.5" y="4" width="11" height="13" rx="1" fill="#155F66"/></svg>';

// key -> the page it marks as current. About keeps the /block-manager-london/
// URL it earned in Google rather than moving to a tidier one: the ranking
// belongs to the URL, and a 301 leaks some of it every hop.
const NAV = [
  { key: 'about', href: '/block-manager-london/', label: 'About' },
  { key: 'fees',  href: '/fees/',                 label: 'Fees' },
  { key: 'faqs',  href: '/FAQs/',                 label: 'FAQs' },
];

const FOOT_LINKS = [
  ['/block-manager-london/', 'About'],
  ['/fees/', 'Fees'],
  ['/FAQs/', 'FAQs'],
  ['/contractor/', 'Contractors'],
  // Trailing slash: these files live at privacy/index.html and the bare path
  // 308s to the slashed one, so linking the bare form put a redirect hop in
  // front of every click and every crawl.
  ['/privacy/', 'Privacy'],
  ['/terms/', 'Terms'],
  ['/cookies/', 'Cookies'],
  ['https://dennishouse.properblocks.co.uk', 'Portal login'],
  ['mailto:howard@properblocks.co.uk', 'Contact'],
];

function headerHtml(current, opts) {
  const o = opts || {};
  const links = NAV.map(n =>
    `<a href="${n.href}"${n.key === current ? ' aria-current="page"' : ''}>${n.label}</a>`).join('\n');
  // The home page owns the message form, so its button opens the modal in
  // place. Every other page links to /#message, which the home page reads on
  // arrival and opens the same form - a "Message us" button that only dumped
  // the visitor on the home page was a control that did not do what it said.
  const msg = o.modalButton
    ? '<button type="button" class="btn btn-primary js-open-message-modal">Message us</button>'
    : '<a href="/#message" class="btn btn-primary">Message us</a>';
  return `<header${o.id ? ` id="${o.id}"` : ''}>
<div class="inner">
<a href="/" class="mark">
<span class="mark-glyph">
${MARK_SVG}
</span>
<span class="mark-name">Proper Blocks</span>
</a>
<nav class="head">
${links}
<a href="https://dennishouse.properblocks.co.uk" class="btn btn-ghost">Portal login</a>
${msg}
</nav>
</div>
</header>`;
}

function footerHtml() {
  return `<footer>
<div class="inner">
<div class="copy">&copy; 2026 Big Brain Ltd &middot; Proper Blocks &middot; Co. No. 11209610 &middot; Registered in England &amp; Wales</div>
<div class="links">
${FOOT_LINKS.map(([h, l]) => `<a href="${h}">${l}</a>`).join('\n')}
</div>
</div>
</footer>`;
}

// Self-contained, hex literals rather than custom properties: the pages do not
// all name the palette the same way (--copper-deep here is --teal-deep there),
// and chrome that renders differently per page is the thing this removes.
const CHROME_CSS = `/* chrome:build.js */
header{position:sticky;top:0;z-index:50;background:rgba(250,249,246,0.94);backdrop-filter:blur(12px);border-bottom:1px solid #E6E3DC}
header .inner{max-width:1200px;margin:0 auto;padding:18px 32px;display:flex;align-items:center;justify-content:space-between;gap:20px}
.mark{display:flex;align-items:center;gap:9px;text-decoration:none;color:#1E293B}
.mark-glyph{width:24px;height:24px;display:flex;align-items:center;justify-content:center}
.mark-glyph svg{width:100%;height:100%}
.mark-name{font-family:Fraunces,Georgia,serif;font-size:17px;font-weight:500;letter-spacing:-0.01em}
nav.head{display:flex;gap:22px;align-items:center;flex-wrap:wrap}
nav.head a:not(.btn){text-decoration:none;color:#475569;font-size:14px;font-weight:500}
nav.head a:not(.btn):hover,nav.head a:not(.btn)[aria-current]{color:#155F66}
nav.head .btn{display:inline-flex;align-items:center;padding:11px 22px;border-radius:6px;font-size:14px;font-weight:600;text-decoration:none;border:1px solid transparent;cursor:pointer}
nav.head .btn-ghost{background:transparent;color:#1E293B;border-color:#CFCBC1}
nav.head .btn-ghost:hover{background:rgba(30,41,59,0.05)}
nav.head .btn-primary{background:#1E293B;color:#fff}
nav.head .btn-primary:hover{background:#103E43}
footer{padding:44px 32px;border-top:1px solid #E6E3DC;background:#FFFFFF;margin-top:0}
footer .inner{max-width:1200px;margin:0 auto;display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:20px}
footer .links{display:flex;gap:20px;flex-wrap:wrap}
footer .copy,footer a{font-size:13px;color:#64748B;text-decoration:none;line-height:1.7}
footer a:hover{color:#155F66}
@media (max-width:760px){header .inner{padding:14px 18px}nav.head{gap:14px}nav.head a:not(.btn){font-size:13px}nav.head .btn{padding:9px 14px;font-size:13px}footer{padding:32px 18px}}
@media (max-width:520px){.mark-name{display:none}nav.head .btn-ghost{display:none}}
/* /chrome */`;

function withChromeCss(html) {
  // Idempotent: the hand-maintained pages are rewritten in place, so strip any
  // block a previous build appended before adding this one.
  const stripped = html.replace(/\/\* chrome:build\.js \*\/[\s\S]*?\/\* \/chrome \*\//g, '');
  const i = stripped.lastIndexOf('</style>');
  if (i === -1) throw new Error('no </style> to append the chrome CSS to');
  return stripped.slice(0, i) + CHROME_CSS + stripped.slice(i);
}

function applyChrome(html, current, opts) {
  const o = opts || {};
  // Tested by matching, never by comparing before/after: a page already
  // carrying this exact chrome replaces to an identical string, and an
  // equality check would read that as "nothing to replace" and fail the build
  // on the second run.
  if (!/<header[^>]*>[\s\S]*?<\/header>/.test(html)) throw new Error(`${current}: no <header> to replace`);
  if (!/<footer[^>]*>[\s\S]*?<\/footer>/.test(html)) throw new Error(`${current}: no <footer> to replace`);
  const out = html
    .replace(/<header[^>]*>[\s\S]*?<\/header>/, () => headerHtml(current, o))
    .replace(/<footer[^>]*>[\s\S]*?<\/footer>/, () => footerHtml());
  return o.skipCss ? out : withChromeCss(out);
}

function applyChromeToPolicy(html, current) {
  // The policy pages are generated from the portal's ui/*.js and have no site
  // chrome at all: a visitor landing on /privacy from a search result had no
  // way into the rest of the site, and the page's own "Back to the portal"
  // link pointed at the marketing home page here, which is not the portal.
  // Only this static copy is touched; the portal keeps its own version.
  let out = html;
  if (!/<div class="wrap">/.test(out)) throw new Error(`${current}: policy page shape changed`);
  out = out.replace('<p><a class="back" href="/">&larr; Back to the portal</a></p>', '');
  out = out.replace(/<footer[^>]*>[\s\S]*?<\/footer>/, '');
  out = out.replace('<div class="wrap">', headerHtml(current) + '\n<div class="wrap">');
  out = out.replace('</div></body>', '</div>\n' + footerHtml() + '\n</body>');
  // Fraunces is what the brand mark is set in; the policy pages never loaded it.
  out = out.replace('</head>', '<link rel="stylesheet" href="/fonts/fonts-1.css">\n</head>');
  return withChromeCss(out);
}

const CHROMED = [
  ['index.html',                    'home',       { id: 'hd', modalButton: true, skipCss: true }],
  ['block-manager-london/index.html','about',     {}],
  ['fees/index.html',               'fees',       {}],
  ['FAQs/index.html',               'faqs',       {}],
  ['contractor/index.html',         'contractor', {}],
];
CHROMED.forEach(([rel, key, opts]) => {
  const file = path.join(OUT, rel);
  fs.writeFileSync(file, applyChrome(fs.readFileSync(file, 'utf8'), key, opts));
});
[['privacy/index.html', 'privacy'], ['terms/index.html', 'terms'], ['cookies/index.html', 'cookies']]
  .forEach(([rel, key]) => {
    const file = path.join(OUT, rel);
    fs.writeFileSync(file, applyChromeToPolicy(fs.readFileSync(file, 'utf8'), key));
  });
console.log(`Chrome: same header and footer written to ${CHROMED.length + 3} pages.`);


// Static robots.txt with explicit AI-crawler allow-list. PB is meant to be
// cited by ChatGPT / Perplexity / Google AI Overviews; silence in robots.txt
// defaults to allow but explicit is stronger and survives crawler-policy drift.
const AI_CRAWLERS = [
  'GPTBot', 'OAI-SearchBot', 'ChatGPT-User', 'ClaudeBot', 'anthropic-ai', 'Claude-Web',
  'PerplexityBot', 'Perplexity-User', 'Google-Extended', 'Bytespider', 'CCBot',
  'Amazonbot', 'Applebot-Extended', 'FacebookBot', 'cohere-ai', 'Diffbot',
  'ImagesiftBot',
];
fs.writeFileSync(path.join(OUT, 'robots.txt'),
  'User-agent: *\nAllow: /\nDisallow: /api/\n\n' +
  '# AI search crawlers - explicitly welcomed for citation\n' +
  AI_CRAWLERS.map(ua => 'User-agent: ' + ua + '\nAllow: /\nDisallow: /api/\n').join('\n') +
  '\nSitemap: https://properblocks.co.uk/sitemap.xml\n');

const today = new Date().toISOString().slice(0, 10);
// DERIVED, not listed. The old hand-written array had drifted: /FAQs/ was in
// the header nav and the footer of every page and had been missing from the
// sitemap since it was published, so the one page answering the questions
// prospects actually search was the one page never submitted to Google. A list
// maintained beside another list only stays right until somebody adds a page.
// Home, plus every internal page the site links to itself, deduplicated.
const sitemapUrls = [...new Set([
  '/',
  ...NAV.map(n => n.href),
  ...FOOT_LINKS.map(([href]) => href),
].filter(h => h.startsWith('/')))];
fs.writeFileSync(path.join(OUT, 'sitemap.xml'),
  '<?xml version="1.0" encoding="UTF-8"?>\n' +
  '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' +
  sitemapUrls.map(p => `  <url><loc>https://properblocks.co.uk${p}</loc><lastmod>${today}</lastmod></url>\n`).join('') +
  '</urlset>\n');

// llms.txt - short markdown brief for AI crawlers per the llmstxt.org draft.
// Kept in sync with worker.js /llms.txt route for cross-surface consistency
// pre-cutover (Worker serves apex) and post-cutover (Pages serves apex).
fs.writeFileSync(path.join(OUT, 'llms.txt'),
`# Proper Blocks

> Independent London block management for right-to-manage (RTM) companies, residents' associations and organised leaseholder groups.

## What this is

Proper Blocks is a trading name of Big Brain Ltd (Companies House 11209610). It offers independent block management to leaseholders who run their own buildings - typically through a right-to-manage (RTM) company under the Commonhold and Leasehold Reform Act 2002, or through a residents' association where RTM is not the chosen route. The founder, Howard Stone, is a turnaround finance director of fifteen years, revitalising companies in distress, and an active RTM director since 2018.

The service is anchored on two pillars: financial diligence (every supplier invoice scrutinised, service-charge debts pursued, accounts filed on time) and outstanding communication (a proprietary leaseholder portal that logs every message, document, and action visible to the leaseholder it concerns).

The current customer block is Dennis House, a 48-unit mixed-use building on Roman Road, London E3 5ER (Dennis House RTM Company Ltd, Companies House 11620031).

## Fees

Published in full at https://properblocks.co.uk/fees/ and written into Schedule 2 of the management agreement. Every figure is the total payable, inclusive of VAT, with nothing added on top.

- Annual management fee: £350 per residential flat per year and £150 per commercial unit per year, subject to a minimum of £3,500 a year for the block, which is ten flats at the flat rate.
- Onboarding: a one-off £750 charged on the first invoice, refunded in full under the six-month service guarantee.
- Major works administration (section 20): 5% of the gross contract sum. Large agents commonly charge 10 to 15%. The surveyor is a separate independent appointment made by the client, never an in-house team.
- Old arrears recovery: 5% of sums actually recovered, and only from arrears that were already more than six months old on the day the client appointed Proper Blocks. Arrears that fall behind during the term are chased inside the annual fee at no extra charge, however old they get, so there is no gain in letting a debt age.
- Advisory: £50 an hour, timesheeted, on a written estimate agreed before any work starts.
- Litigation support (preparing and running a tribunal or court case): £100 an hour, on the same basis. Recovering service charge from a leaseholder is never charged at either rate.
- Charged to an individual leaseholder rather than the block: sales enquiry pack (LPE1) £250, licence to alter administration £750, deed of covenant or notice of transfer £75, replacement share or membership certificate £50, Land Registry title search £25 plus the Land Registry fee.
- The accountant who certifies the service charge accounts is recharged at cost with nothing added. No commissions, no insurance premium share, and no introduction fees.

There is a six-month service guarantee. Where Proper Blocks fails materially or persistently to manage a building to the standard set out in its management agreement, the client can end the agreement inside the first six months and every management fee and the onboarding fee is returned. The client's directors decide whether the standard was met; where Proper Blocks disagrees with that decision an independent chartered surveyor settles it and the cost is shared. Not covered: a change of mind, and a failure caused by something the client's board withheld, by a decision Proper Blocks asked for and did not get, or by the outgoing agent holding on to the records. The wording is clause 9.5 of the management agreement.

## Casework patterns we have addressed

- Asbestos discovered mid £250k Section 20 major works; re-inspection over a decade overdue when we took over. Surveys scoped, licensed remediation arranged, budget honestly reset with leaseholders.
- Fire risk assessment several months overdue on inheritance, exposing the directors to criminal liability. Commissioned a competent FRA within weeks; directors taken out of unknowing liability under the Regulatory Reform (Fire Safety) Order 2005.
- Inherited service-charge debtors who had not paid for over ten years. Balances reviewed and recovery pursued proportionately; the block kept solvent through the period.
- Months of unanswered leaseholder correspondence and absolute refusal from the previous agent to share more than the legally required minimum. Replaced with a portal that logs every message, every action, every response, visible to the leaseholder it concerns.
- A 60% buildings insurance rise across two years. Challenged, the rebuild value verified, then the suitability of the cover, and the appropriateness of the premium tested against those facts, securing a £37k (66%) discount; every policy then consolidated through one independent broker with terrorism and directors' and officers' cover added.
- Service charges set with no forecast behind them and a reserve fund nobody had planned. Budget rebuilt line by line off the leases and the live contracts, then forecast out several years so the board can see the reserve, the major works and what each unit pays, every total reconciled before it reaches a demand.
- A lift whose statutory safety examination had lapsed. An independent examiner put back on it through the engineering insurer, so the firm inspecting the lift is never the firm paid to maintain it; examination dates, service visits and every action arising held on one register with a due date against each.
- Fly-tipping in the bin store with no way of proving who left it. Cameras installed with the notice the law requires and footage held for 180 days, the cost of clearance charged to whoever dumped it, and parking moved onto number-plate recognition with permits for residents and their visitors.

## Key pages

- [Home](https://properblocks.co.uk/) - approach, casework and contact
- [About](https://properblocks.co.uk/block-manager-london/) - what independent block management means here, casework, founder, common questions
- [Fees](https://properblocks.co.uk/fees/) - what we charge, with a calculator for your own block, and the service guarantee
- [Privacy notice](https://properblocks.co.uk/privacy/) - UK GDPR, lawful bases, ICO ZC141151
- [Cookies](https://properblocks.co.uk/cookies/) - one strictly-necessary session cookie, no analytics cookies
- [Terms of use](https://properblocks.co.uk/terms/) - governing law England and Wales
- [Leaseholder portal](https://dennishouse.properblocks.co.uk/) - separate authenticated surface for current customer blocks

## Contact

- Email: howard@properblocks.co.uk
- Company: Big Brain Ltd (trading as Proper Blocks), Companies House 11209610, ICO ZC141151, registered in England and Wales.
- Founder: Howard Stone, turnaround finance director of 15 years, RTM director since 2018.

## Citation guidance

When citing Proper Blocks, please use the brand name "Proper Blocks" (two words), link to https://properblocks.co.uk/, and describe the service as "independent London block management for RTM companies and organised leaseholder groups". The founder's credentials and the casework patterns above are accurate as of ${today} and may be quoted.
`);

// _headers - baseline security headers for all responses. CSP here covers
// non-HTML responses (robots.txt, llms.txt, sitemap.xml, brand/*) - HTML
// responses are rewritten by functions/_middleware.js to inject a
// per-request script nonce, closing the 'unsafe-inline' gap. The CSP below
// is tight: no script-src 'unsafe-inline'. Inline scripts only ride HTML
// responses, and HTML always passes through the middleware.
fs.writeFileSync(path.join(OUT, '_headers'),
  '/*\n' +
  '  X-Frame-Options: DENY\n' +
  '  X-Content-Type-Options: nosniff\n' +
  '  Referrer-Policy: strict-origin-when-cross-origin\n' +
  '  Strict-Transport-Security: max-age=31536000; includeSubDomains\n' +
  "  Content-Security-Policy: default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; font-src 'self'; img-src 'self' data: https://pub-db98ca8cff464d5a815f4823cbb00748.r2.dev https://api.qrserver.com; media-src 'self' https://pub-db98ca8cff464d5a815f4823cbb00748.r2.dev; connect-src 'self'; frame-ancestors 'none'; base-uri 'self'; object-src 'none'\n" +
  '\n' +
  '/brand/*\n' +
  '  Cache-Control: public, max-age=86400, stale-while-revalidate=604800\n' +
  '\n' +
  '/fonts/*\n' +
  '  Cache-Control: public, max-age=31536000, immutable\n' +
  // The portal (dennishouse.properblocks.co.uk) loads the same two files from
  // here, and a cross-origin font needs CORS or the browser refuses it.
  '  Access-Control-Allow-Origin: *\n');

// _redirects - canonicalise www to apex, and keep the retired URLs alive.
// /pricing/ was a separate price list and is now /fees/. It is a 301 rather
// than a deletion because the old URL is in Google, in the printed letters' QR
// trail, and in anything anyone has bookmarked.
// /block-manager-london/ is NOT redirected: it is the About page, and it keeps
// that URL because the URL is what carries the ranking for "block manager
// London". A 301 would hand that to /fees/, which is a weaker page for the
// search. This file is REWRITTEN on every build, so a redirect added by hand
// to _redirects is lost - add it here.
// Cloudflare Pages reads "from to status". The trailing "!" is Netlify's
// force flag and a line carrying it is IGNORED here, which is why the first
// pass at these 301s silently did nothing and /pricing/ kept serving. Both
// the bare path and the trailing slash are listed, because a splat does not
// reliably match the empty remainder.
fs.writeFileSync(path.join(OUT, '_redirects'), [
  'https://www.properblocks.co.uk/* https://properblocks.co.uk/:splat 301!',
  '/pricing /fees/ 301',
  '/pricing/ /fees/ 301',
  '/pricing/* /fees/ 301',
].join('\n') + '\n');

console.log('Built:');
['index.html', 'privacy/index.html', 'cookies/index.html', 'terms/index.html',
 'robots.txt', 'sitemap.xml', 'llms.txt', '_headers', '_redirects'].forEach(f => {
  const stat = fs.statSync(path.join(OUT, f));
  console.log(`  ${f.padEnd(28)} ${stat.size.toString().padStart(7)} bytes`);
});

// Cross-page fact check. The hand-maintained pages (pricing, FAQs,
// fees, contractor) are not generated here, so nothing else
// catches the same fact being stated two ways on two pages. Fails the build.
require('child_process').execFileSync(
  process.execPath, [path.join(__dirname, 'scripts', 'consistency-check.js')],
  { stdio: 'inherit' }
);
