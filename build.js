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
const sitemapUrls = ['/', '/privacy/', '/terms/', '/cookies/', '/block-manager-london/', '/contractor/'];
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

Proper Blocks is a trading style of Big Brain Ltd (Companies House 11209610). It offers independent block management to leaseholders who run their own buildings - typically through a right-to-manage (RTM) company under the Commonhold and Leasehold Reform Act 2002, or through a residents' association where RTM is not the chosen route. The founder, Howard Stone, is a chartered accountant (ICAEW) and an active RTM director since 2018.

The service is anchored on two pillars: financial diligence (every supplier invoice scrutinised, service-charge debts pursued, accounts filed on time) and outstanding communication (a proprietary leaseholder portal that logs every message, document, and action visible to the leaseholder it concerns).

The current customer block is Dennis House, a 48-unit mixed-use building on Roman Road, London E3 5ER (Dennis House RTM Company Ltd, Companies House 11620031).

## Casework patterns we have addressed

- Asbestos discovered mid £250k Section 20 major works; re-inspection over a decade overdue when we took over. Surveys scoped, licensed remediation arranged, budget honestly reset with leaseholders.
- Fire risk assessment several months overdue on inheritance, exposing the directors to criminal liability. Commissioned a competent FRA within weeks; directors taken out of unknowing liability under the Regulatory Reform (Fire Safety) Order 2005.
- Inherited service-charge debtors with the largest unpaid for seven years. Balances reviewed and recovery pursued proportionately; the block kept solvent through the period.
- Months of unanswered leaseholder correspondence and absolute refusal from the previous agent to share more than the legally required minimum. Replaced with a portal that logs every message, every action, every response, visible to the leaseholder it concerns.

## Key pages

- [Home](https://properblocks.co.uk/) - approach, casework and contact
- [Block manager - London](https://properblocks.co.uk/block-manager-london/) - service detail, fees, FAQ, founder credentials
- [Privacy notice](https://properblocks.co.uk/privacy/) - UK GDPR, lawful bases, ICO ZC141151
- [Cookies](https://properblocks.co.uk/cookies/) - one strictly-necessary session cookie, no analytics
- [Terms of use](https://properblocks.co.uk/terms/) - governing law England and Wales
- [Leaseholder portal](https://dennishouse.properblocks.co.uk/) - separate authenticated surface for current customer blocks

## Contact

- Email: hello@properblocks.co.uk
- Company: Big Brain Ltd (trading as Proper Blocks), Companies House 11209610, ICO ZC141151, registered in England and Wales.
- Founder: Howard Stone, chartered accountant (ICAEW), RTM director since 2018.

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
  "  Content-Security-Policy: default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src https://fonts.gstatic.com; img-src 'self' data: https://pub-db98ca8cff464d5a815f4823cbb00748.r2.dev https://api.qrserver.com; media-src 'self' https://pub-db98ca8cff464d5a815f4823cbb00748.r2.dev; connect-src 'self'; frame-ancestors 'none'; base-uri 'self'; object-src 'none'\n" +
  '\n' +
  '/brand/*\n' +
  '  Cache-Control: public, max-age=86400, stale-while-revalidate=604800\n');

// _redirects - canonicalise www to apex.
fs.writeFileSync(path.join(OUT, '_redirects'),
  'https://www.properblocks.co.uk/* https://properblocks.co.uk/:splat 301!\n');

console.log('Built:');
['index.html', 'privacy/index.html', 'cookies/index.html', 'terms/index.html',
 'robots.txt', 'sitemap.xml', 'llms.txt', '_headers', '_redirects'].forEach(f => {
  const stat = fs.statSync(path.join(OUT, f));
  console.log(`  ${f.padEnd(28)} ${stat.size.toString().padStart(7)} bytes`);
});
