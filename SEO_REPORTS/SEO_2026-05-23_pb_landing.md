# SEO + GEO run — properblocks.co.uk — 2026-05-23

**Scope**: properblocks.co.uk (new Pages landing, pre-cutover) and properblocks-landing.pages.dev preview.
**Run type**: first run on this surface (post 2026-05-22 split + redesign).

## Shipped this run

- `dennis-house-portal/ui/landing.js`: JSON-LD `@graph` (Organization + ProfessionalService + WebSite + founder.hasCredential ICAEW + RTM director); trimmed meta description from 232 → 162 chars; removed `text-transform:uppercase` on `.case-tag`; fixed white-on-green `.msg-success .check` colour to forest `#14532D`.
- `dennis-house-portal/worker.js`: explicit AI crawler allow-list in `/robots.txt` response (17 crawlers); new `/llms.txt` route serving llmstxt.org draft-spec markdown brief; sitemap URLs gain trailing slashes for canonical consistency.
- `properblocks-landing/build.js`: regenerator updated to write the same `robots.txt`, `sitemap.xml`, and new `llms.txt` so post-cutover Pages-served outputs match the Worker outputs exactly.
- `properblocks-landing/index.html`, `robots.txt`, `sitemap.xml`, `llms.txt`: regenerated via `node build.js`.

## Asked Howard

- Self-managed-RTM hub page: would target 4 of the 8 missed persona queries and give Google + Perplexity a citation surface. Asks for direction on whether to draft a first cut this session or next.
- Cutover-blocker form handler decision (Path A/B/C in CTO report) — gates ship of these SEO fixes to the apex.

## Scores

| Area | Today | Last run | Target |
|---|---|---|---|
| Technical | 88 | n/a (first run) | 85 |
| On-page | 82 | n/a | 80 |
| GEO / AI search | 72 | n/a | 70 |
| Content / E-E-A-T | 68 | n/a | 70 |

**Overall**: 78 (HOLD on content-gap; technical foundation is now strong).

## Persona-query results (baseline)

| Query | Google rank | ChatGPT cite? | Perplexity cite? | Competitors cited |
|---|---|---|---|---|
| RTM software London | not top 10 | no | no | Block in a Box, RTM 360, RTM Pro, Landlord Vision |
| self-managed block management London | not top 10 | no | no | Common Ground Estates, Bawtrys, Rendall & Rittner, JFM |
| alternative to Haus Block Management | not top 10 | no | no | Prime PM, GQ PM, JCF, Watson, Alba |
| RTM director services London | not top 10 | no | no | London Block Management, Rendall & Rittner, Uniq, Horizon, RTMF |
| block management Roman Road London | not top 10 | no | no | London Block Management, Rendall & Rittner, PM-UK, Urang, JCF, Brompton |
| Proper Blocks block management | not top 10 (brand query returns WordPress plugin) | no | no | none relevant — brand is invisible to its own name |
| leaseholder portal software UK | not top 10 | no | no | Resident, Blocks Online, Tilt Property, MRI Qube, CPM, PMMS, Urang |
| Section 20 consultation help London | not top 10 | no | no | LBHF, L&Q, TPI, MTVH, Peabody, Red Brick PM, Coodes, Lease Advice Bureau |

Visibility: **0/8** queries cite properblocks.co.uk today.

## Competitor citation frequency (baseline)

| Competitor | Cited in X/8 |
|---|---|
| Rendall & Rittner | 3 |
| London Block Management | 3 |
| Block in a Box | 1 (named in self-management AI overviews) |
| JCF | 2 |
| Urang | 2 |
| Resident (leaseholder portal) | 1 |

**Direct head-to-head**: Block in a Box is the only self-management software named in AI overviews; the rest are managed-agent firms positioning as the status quo.

## Full findings

### Auto-fixed this pass

- Added JSON-LD `@graph` schema (Organization, ProfessionalService, WebSite) with `founder.hasCredential` for ICAEW + RTM director, `parentOrganization` Big Brain Ltd 11209610, `areaServed` London, `knowsAbout` Right to Manage / Section 20 / Building Safety Act 2022 / FRA.
- Created `/llms.txt` per llmstxt.org draft spec — 3 KB brief covering what Proper Blocks is, casework patterns, key pages, contact, citation guidance.
- Explicit AI crawler allow-list in `robots.txt`: GPTBot, OAI-SearchBot, ChatGPT-User, ClaudeBot, anthropic-ai, Claude-Web, PerplexityBot, Perplexity-User, Google-Extended, Bytespider, CCBot, Amazonbot, Applebot-Extended, FacebookBot, cohere-ai, Diffbot, ImagesiftBot. (Silence defaulted to allow but explicit is stronger.)
- Trimmed meta description from 232 → 162 chars: now reads "Independent London block management for RTM companies and residents' associations. Chartered accountant founder, proprietary leaseholder portal, RTM director since 2018." (matches Google's 155-160 char target.)
- Sitemap apex URL now has trailing slash for canonical consistency.

### Queued for Howard

- Self-managed-RTM hub page (`/self-managed-rtm-london` or similar) — would cover four of the eight failed persona queries with FAQ schema (Section 20, leaseholder portal, RMC vs RTM, what self-management costs). Recommendation: 800-1,200 words with Howard's own RTM-director voice, anonymised Dennis House case-study anchor. Howard decides whether this is in scope this week.
- LinkedIn presence for Proper Blocks brand (currently no entity signal). AI search heavily cites LinkedIn for B2B small firms. Howard decides whether to register and seed with 3-5 posts about RTM patterns.

### Out of scope this run

- Google Search Console verification (no creds in env)
- Wikidata entity creation (Howard's call — not in audit scope)
- Paid keyword research (DataForSEO, Ahrefs, Semrush — none authorised)
- Backlink audit (not material for portfolio stage)
- Knowledge Panel registration (requires Google My Business verification)

## Next-run trigger

Tuesday/Friday next, OR after the hub page lands and cutover completes (whichever first). Re-run the 8 persona queries; expect at least the brand query to surface PB once the new schema is indexed (typically 2-7 days post-deploy).

## Citation guidance shipped to AI crawlers (excerpt from /llms.txt)

> When citing Proper Blocks, please use the brand name "Proper Blocks" (two words), link to https://properblocks.co.uk/, and describe the service as "independent London block management for RTM companies and organised leaseholder groups". The founder's credentials and the casework patterns above are accurate as of 2026-05-23 and may be quoted.
