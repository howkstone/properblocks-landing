#!/usr/bin/env node
// Security check for properblocks.co.uk (security sweep, 7 Nov 2026).
//
// Why this exists: the sweep found two things on the live site.
//   5. Every unknown address answered 200 with the home page, including
//      /.htaccess, /.svn/entries and /api/...: a "soft 404". Cloudflare Pages
//      falls back to the home page (single-page-app mode) whenever the project
//      has no top-level 404.html; with one, an unknown address answers 404
//      with that page. So the fix is the file, and this holds it there.
//   6. Links that open a new tab had rel="noopener" without "noreferrer"
//      (LinkedIn twice, the Property Ombudsman and the ICO on the home page;
//      the Ombudsman mark in every page footer).
// It also holds the header set in _headers, so the 404 page and every static
// file carry HSTS, a CSP with frame-ancestors 'none', frame refusal, nosniff
// and a referrer policy.
//
// Run: node scripts/security-check.js   (build.js and CI run it)
//      node scripts/security-check.js --self-test

const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const failures = [];
let checks = 0;
const check = (name, ok, detail) => { checks++; if (!ok) failures.push(name + (detail ? " - " + detail : "")); };

function newTabLinks(src) {
  const out = [];
  for (const m of src.matchAll(/<a\b[^<>]*?\btarget\s*=\s*\\?["']_blank\\?["'][^<>]*>/g)) {
    const rel = (m[0].match(/rel\s*=\s*\\?["']([^"'\\]*)/) || [])[1] || "";
    out.push({ tag: m[0], ok: /\bnoopener\b/.test(rel) && /\bnoreferrer\b/.test(rel) });
  }
  return out;
}

if (process.argv.includes("--self-test")) {
  const bad = newTabLinks('<a href="x" target="_blank" rel="noopener">x</a><a target="_blank" href="y">y</a>');
  const good = newTabLinks('<a href="x" target="_blank" rel="noopener noreferrer">x</a>');
  const ok = bad.length === 2 && bad.every(l => !l.ok) && good.length === 1 && good[0].ok;
  console.log("security-check self-test: " + (ok ? "OK" : "FAIL"));
  process.exit(ok ? 0 : 1);
}

// 5. The 404 page.
const nf = path.join(ROOT, "404.html");
const nfHtml = fs.existsSync(nf) ? fs.readFileSync(nf, "utf8") : "";
check("404.html exists at the top level (turns off the home-page fallback; unknown addresses answer 404)", !!nfHtml);
check("404.html says the page was not found", /<h1>Page not found<\/h1>/.test(nfHtml));
check("404.html is kept out of search results", /<meta name="robots" content="noindex">/.test(nfHtml));
check("404.html carries the site header and footer", /<header[\s>]/.test(nfHtml) && /<footer[\s>]/.test(nfHtml));

// 6. Every new-tab link in every published page and in build.js.
function walk(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap(e => {
    if ([".git", "node_modules", ".github", ".claude", "scripts", "CTO_REPORTS", "UAT_REPORTS", "SEO_REPORTS"].includes(e.name)) return [];
    const p = path.join(dir, e.name);
    return e.isDirectory() ? walk(p) : (/\.(html|js)$/.test(e.name) ? [p] : []);
  });
}
let links = 0;
for (const f of walk(ROOT)) {
  for (const l of newTabLinks(fs.readFileSync(f, "utf8"))) {
    links++;
    check(path.relative(ROOT, f) + ': new-tab link has rel="noopener noreferrer"', l.ok, l.tag.slice(0, 140));
  }
}
check("the new-tab link population is not empty", links > 0, "found " + links);

// Headers: the catch-all block in _headers.
const hd = fs.readFileSync(path.join(ROOT, "_headers"), "utf8");
const all = (hd.split(/\n(?=\S)/).find(b => b.startsWith("/*")) || "");
check("_headers /* sets HSTS", /Strict-Transport-Security: max-age=\d+/.test(all));
check("_headers /* sets a CSP with frame-ancestors 'none'", /Content-Security-Policy:.*frame-ancestors 'none'/.test(all));
check("_headers /* refuses framing", /X-Frame-Options: DENY/.test(all));
check("_headers /* sets nosniff", /X-Content-Type-Options: nosniff/.test(all));
check("_headers /* sets a referrer policy", /Referrer-Policy: \S+/.test(all));

if (failures.length) {
  console.error("security-check: FAIL (" + failures.length + " of " + checks + ")\n  " + failures.join("\n  "));
  process.exit(1);
}
console.log("security-check: OK (" + checks + " checks, " + links + " new-tab links, all noopener noreferrer; 404.html in place)");
