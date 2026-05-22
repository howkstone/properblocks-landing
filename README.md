# properblocks-landing

Static Cloudflare Pages source for `properblocks.co.uk` and `www.properblocks.co.uk`.

Split out of the Dennis House Worker on 2026-05-22 so the marketing landing
page no longer pays the cold-start tax of a 3,000-line portal Worker. The
leaseholder portal at `portal.properblocks.co.uk` continues to be served by
the `dennis-house-portal` Worker.

## Structure

| Path | Source | Notes |
|---|---|---|
| `index.html` | `dennis-house-portal/ui/landing.js` | Hero, scroll-driven morph video, two-pillar approach, CTA. |
| `privacy/index.html` | `dennis-house-portal/ui/privacy.js` | Privacy notice, ICO ZC141151. |
| `cookies/index.html` | `dennis-house-portal/ui/cookies.js` | Single session cookie, no third parties. |
| `terms/index.html` | `dennis-house-portal/ui/terms.js` | Terms of use, governing law England & Wales. |
| `brand/buildings.jpg` | R2 `public/brand-buildings.jpg` | Inlined into repo (188 KB). |
| `brand/morph.mp4` | R2 `public/dh-morph.mp4` | Inlined into repo (6.8 MB). |
| `robots.txt` | inline static | |
| `sitemap.xml` | inline static | Regenerate `lastmod` per deploy. |
| `_headers` | replicated from DH Worker `SECURITY_HEADERS` | CSP, HSTS, frame deny, content-type nosniff. |
| `_redirects` | `www` -> apex 301 | Replaces Worker `Response.redirect` from old serve block. |

## Rebuild

If `landing.js` / `privacy.js` / `cookies.js` / `terms.js` change in the
`dennis-house-portal` repo, run:

```
node build.js
```

The script reads the four UI modules from `C:\Users\user\dennis-house-portal\ui\`,
strips the JS module wrapper, inlines the shared policy CSS, and writes the
static HTML files.

## Deploy

Auto-deploys via Cloudflare Pages on every push to `main`. The Pages project
name is `properblocks-landing` and the custom domains attached are
`properblocks.co.uk` and `www.properblocks.co.uk`.

## Cutover note (2026-05-22)

The custom-domain handover from the Worker to Pages happens in a single
coordinated sequence so the public window of unreachability stays under 90
seconds. See `CUTOVER.md` for the runbook.
