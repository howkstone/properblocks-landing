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

// Static robots.txt + sitemap.xml.
fs.writeFileSync(path.join(OUT, 'robots.txt'),
  'User-agent: *\nAllow: /\nSitemap: https://properblocks.co.uk/sitemap.xml\n');

const today = new Date().toISOString().slice(0, 10);
const sitemapUrls = ['', '/privacy', '/terms', '/cookies'];
fs.writeFileSync(path.join(OUT, 'sitemap.xml'),
  '<?xml version="1.0" encoding="UTF-8"?>\n' +
  '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' +
  sitemapUrls.map(p => `  <url><loc>https://properblocks.co.uk${p}</loc><lastmod>${today}</lastmod></url>\n`).join('') +
  '</urlset>\n');

// _headers - replicate the DH Worker's SECURITY_HEADERS for parity.
fs.writeFileSync(path.join(OUT, '_headers'),
  '/*\n' +
  '  X-Frame-Options: DENY\n' +
  '  X-Content-Type-Options: nosniff\n' +
  '  Referrer-Policy: strict-origin-when-cross-origin\n' +
  '  Strict-Transport-Security: max-age=31536000; includeSubDomains\n' +
  "  Content-Security-Policy: default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src https://fonts.gstatic.com; img-src 'self' data: https://api.qrserver.com; connect-src 'self'\n" +
  '\n' +
  '/brand/*\n' +
  '  Cache-Control: public, max-age=86400, stale-while-revalidate=604800\n');

// _redirects - canonicalise www to apex.
fs.writeFileSync(path.join(OUT, '_redirects'),
  'https://www.properblocks.co.uk/* https://properblocks.co.uk/:splat 301!\n');

console.log('Built:');
['index.html', 'privacy/index.html', 'cookies/index.html', 'terms/index.html',
 'robots.txt', 'sitemap.xml', '_headers', '_redirects'].forEach(f => {
  const stat = fs.statSync(path.join(OUT, f));
  console.log(`  ${f.padEnd(28)} ${stat.size.toString().padStart(7)} bytes`);
});
