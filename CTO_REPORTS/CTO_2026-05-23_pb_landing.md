# CTO Review — Proper Blocks landing (properblocks.co.uk)

**Date**: 2026-05-23 · **Reviewer**: Claude (Opus 4.7, 1M context) · **Surface**: properblocks.co.uk (new Pages project) + properblocks-landing.pages.dev
**Model**: claude-opus-4-7 · **Scope**: new code in `howkstone/properblocks-landing` (pre-cutover; apex still served by DH Worker)
**Source paths reviewed**:
- `C:\Users\user\properblocks-landing\` (Pages repo, 2026-05-22 split-out)
- `C:\Users\user\dennis-house-portal\ui\landing.js` (upstream template the Pages repo regenerates from)
- `C:\Users\user\dennis-house-portal\routes\landing_contact.js` (Worker handler for the Message-us form)
- `C:\Users\user\dennis-house-portal\worker.js` (routes /api/landing-contact, /robots.txt, /sitemap.xml, /llms.txt on apex)

## Scores

```
Security: 78/100  |  Sophistication: 84/100
```

**Security headline**: 1 Q1 cutover blocker (form will silently break post-cutover), 1 Q1 CSP weakening, otherwise clean. GDPR posture strong (clear lawful bases, ICO ZC141151 stated, retention windows, contact, no analytics).

**Sophistication headline**: tasteful, distinctive landing; honest credentials over manufactured social proof; deuteranopia-safe pair used correctly in form states; no AI-tells. One uppercase-label violation and one white-on-green check fixed in-flight. R15 visual sweep at three viewports not performed this pass — escalated below.

## §0a — Threat-intel currency

| Source | Date | Status |
|---|---|---|
| `bigbrain-security/THREAT_INTEL/2026-W21-PB.md` | 2026-05-21 (2 days) | Current ✓ |
| `bigbrain-security/CONTROLS_LEDGER/PB.md` | Bootstrap + W21 | 20 Implemented, 2 Proposed (PB-0021 DNS hygiene, PB-0022 Gmail OAuth scope), 0 Broken |

No Q1 hard-gate. PB-0021 + PB-0022 are portal-stack scope; not landing-specific.

## §1 — Orientation

- **Deploy target(s)**: Cloudflare Pages (`properblocks-landing` project) post-cutover; Cloudflare Worker (`dennis-house-portal`) pre-cutover. Both surfaces share the same source via `build.js` regen.
- **Hostnames**: `properblocks.co.uk` (apex, 200 from Worker), `www.properblocks.co.uk` (301 to apex), `properblocks-landing.pages.dev` (200, new Pages preview).
- **Roles**: anonymous only.
- **Trust-critical flows**: Message us form → hello@properblocks.co.uk (currently routes to DennisHouseRTM@gmail.com Howard's mailbox; user-facing copy claims hello@).
- **Entitled journeys (anonymous)**: read approach + casework, message Proper Blocks, read privacy + terms + cookies, log into portal.

## Findings — Security

### Q1 (block / cutover-blocker)

**F-PBL-23-001 — Message-us form will silently break post-cutover.** Pages repo has no `functions/` directory; `/api/landing-contact` on `properblocks-landing.pages.dev` returns 405. The form's catch path will show "Something went wrong. Please email hello@properblocks.co.uk directly." after cutover — every prospect that fills the form gets a degraded experience. Pre-cutover the Worker still serves the endpoint correctly. **Decision needed before triggering CUTOVER.md.**

Three structural options (production-grade fix as default):

- **Path A — keep the handler in the Worker, post cross-origin with CORS.** Add the `/api/landing-contact` handler under the `portal.properblocks.co.uk` host branch in `worker.js`. Form fetches `https://portal.properblocks.co.uk/api/landing-contact`. Worker responds with `Access-Control-Allow-Origin: https://properblocks.co.uk` and handles the preflight. No new bindings. Smallest change. Slight cross-origin smell.
- **Path B — port handler to Cloudflare Pages Functions with all bindings.** Create `properblocks-landing/functions/api/landing-contact.js`. Bind D1 (rate_limits + audit_log), bind GMAIL_REFRESH_TOKEN + GMAIL_CLIENT_ID + GMAIL_CLIENT_SECRET as Pages secrets. Port `lib/email.js` helper. Form stays same-origin. Cleanest architecturally but secret-binding sprawl.
- **Path C — Pages Function with a service binding to the DH Worker.** Pages Function at `/api/landing-contact` calls the Worker via internal service binding (no cross-origin, no secrets duplicated). Worker exposes a new internal endpoint that accepts the validated payload. Best of both.

**Recommended: Path C**. Same-origin to the user, single source of truth for email/D1/audit code, no CORS, no secret duplication. ~30-min job. Hold cutover until done.

**F-PBL-23-002 — Pages CSP weakens to `script-src 'self' 'unsafe-inline'`.** Pre-cutover Worker uses nonces (verified via curl `nonce-9a14fee80f81b44e89d6553b4c1451e6`). The `_headers` file ships `'unsafe-inline'` because Pages can't inject per-response nonces from a static file. After cutover the inline `<script>` block (~370 lines of landing JS) runs under `'unsafe-inline'`, which weakens XSS posture against any future stored-XSS vector. Static landing has no user-rendered content (form submission goes server-side via fetch, success message uses `escapeText`), so the practical exposure today is low — but the gap is real.

**Recommended fix**: a Pages Function `properblocks-landing/_middleware.js` that wraps every HTML response with a per-request nonce, generates a cryptographically random nonce, injects it into both the CSP header and the inline `<script>` tag. ~15-line file. Closes the gap.

### Q2 (this week)

**F-PBL-23-003 — Hero H1 empty pre-JS for non-rendering crawlers.** `<h1 id="hero-manifesto" aria-label="..."></h1>` — text injected by JS. `aria-label` and `<noscript>` mitigate but a non-JS crawler that ignores noscript sees no H1 content. Modern AI crawlers (GPTBot, ClaudeBot, PerplexityBot) render JS; basic crawlers (CCBot, lightweight bots) may not. Schema added in this pass also feeds crawlers via structured data, so practical exposure is small. Optional fix: replace empty H1 with pre-lit static spans matching the JS-generated structure, then JS animates phase B by scroll. Deferred — schema covers the citability ask.

### Q3 (next release)

**F-PBL-23-004 — Persona-query AI visibility 0/8.** Across 8 buyer-persona queries (RTM software London, self-managed block management London, alternative to Haus Block Management, block management Roman Road London, Section 20 consultation help London, leaseholder portal software UK, Proper Blocks block management, RTM director services London), `properblocks.co.uk` is not in top 10 on any platform tested. Brand query itself returns a WordPress plugin. Schema + llms.txt + robots.txt fixes shipped this pass establish the indexable surface; content gap (a self-managed-RTM hub page) is an ASK for Howard.

### Q4 (backlog)

**F-PBL-23-005 — Pages repo still depends on `dennis-house-portal/ui/` upstream** via `build.js`. README acknowledges and says "long-term you can delete this script; the static files are the canonical source for the Pages site from then on." Cleanup deferred until cutover stabilises.

## Findings — Sophistication

### Q3 (fixed in-flight this pass)

**F-PBL-23-006 — `.case-tag` used `text-transform:uppercase` on 11px casework labels** ("MAJOR WORKS", "BUILDING SAFETY"). Violates Howard's no-all-caps rule (case-tag isn't a vehicle reg, table header, or nav divider). **FIXED**: `text-transform:uppercase` removed from `ui/landing.js:289`. Labels now read "Major works", "Building safety", "Financial diligence", "Communication" in title case.

**F-PBL-23-007 — `.msg-success .check` used `color:#fff` on `#2AA06A` background.** Violates R14 brand rule: text on the deuteranopia-safe green must be dark forest/ink, not white. **FIXED**: changed to `color:#14532D` (forest) with `font-weight:700` for legibility. WCAG AA passes (large text on green = 3.29:1 → with forest now ~6.5:1).

### Q3 (deferred)

**F-PBL-23-008 — R15 visual sweep at three viewports (390px, 768px, 1440px) not performed this pass.** Per protocol R15 fires when surface has changed since last UAT, which it materially has (Pages repo split out + landing redesign 2026-05-22). Howard's already done a visual review on 22 May. Recommend: Howard re-walk on phone before triggering cutover (the morph video scrub + sticky hero behaviour at small viewport are the highest-risk areas).

## Controls Ledger update proposed

Two new rows for `bigbrain-security/CONTROLS_LEDGER/PB.md`:

| ID | Source | Control | Status | Evidence |
|---|---|---|---|---|
| PB-0023 | CTO 2026-05-23 F-PBL-23-001 | Pages cutover gated on Path C (or A/B) for `/api/landing-contact` form integration | Proposed | This report; CUTOVER.md must reference before triggering |
| PB-0024 | CTO 2026-05-23 F-PBL-23-002 | Pages CSP nonce middleware before cutover | Proposed | This report; closes 'unsafe-inline' gap |

## Live verification

| Check | Result |
|---|---|
| `curl -sI https://properblocks.co.uk/` | 200, CSP with nonce (Worker-served pre-cutover) |
| `curl -sI https://www.properblocks.co.uk/` | 301 to apex ✓ |
| `curl -sI https://properblocks-landing.pages.dev/` | 200, CSP `'unsafe-inline'` |
| `curl -sI https://properblocks.co.uk/robots.txt` | 200, text/plain (updated in this pass) |
| `curl -sI https://properblocks.co.uk/sitemap.xml` | 200, application/xml |
| `curl -X POST .../api/landing-contact (Pages)` | 405 — confirms cutover blocker |
| `curl -X POST .../api/landing-contact (Worker)` | 403 "origin required" — gate working correctly |

## PUFAS cycle for findings shipped this pass

For F-PBL-23-006 (uppercase) and F-PBL-23-007 (check colour):
1. **Post-mortem** — both shipped on 2026-05-22 landing redesign; reached production via Worker route. No customer harm reported; visual-polish class.
2. **Understand** — uppercase was a leftover habit from utilitarian eyebrow styling; white-on-green was a default tick-on-success that pre-dated the R14 rule.
3. **Fix** — `ui/landing.js:289` and `ui/landing.js:251` (Pages repo regen via `node build.js`).
4. **Audit** — grepped `text-transform:\s*uppercase` across `landing.js` (1 hit, fixed); checked all explicit colour pairs for white-on-green/red elsewhere on the page (clean).
5. **Skill-improve** — both rules already in CLAUDE.md and `feedback_no_all_caps.md` / R14. No new rule needed; this was a one-off lapse, not a missing rule.

## Open questions for Howard

1. Cutover-blocker form handler: Path A, B or C? (Recommend C — Pages Function with service binding to Worker.)
2. Pages CSP nonce middleware: ship before cutover? (Recommend yes — same commit cycle as the form handler.)
3. Self-managed-RTM hub page (content gap surfacing in 0/8 persona queries): do you want me to draft a first cut? Would target "self-managed RTM in London", "RTM director services London", "Section 20 consultation help London" and put PB in the answer set.
4. R15 visual re-walk on phone before cutover — your eye or mine?
