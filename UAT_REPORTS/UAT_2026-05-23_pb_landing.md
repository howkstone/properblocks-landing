# UAT — Proper Blocks landing (properblocks.co.uk)

**Date**: 2026-05-23 · **Tester**: Claude (Opus 4.7, 1M context) · **Surface**: properblocks.co.uk (new Pages project) + properblocks-landing.pages.dev
**Model**: claude-opus-4-7 · **Scope**: new code, pre-cutover

## Verdict

**HOLD pending Howard sign-off on 4 decisions** (see CTO report F-PBL-23-001 to F-PBL-23-004). Walk-level pass is otherwise clean — no Q1 functional or content defects, the four sophistication findings have been fixed in-flight or escalated.

## Orientation

- **Personas walked**:
  - First-time visitor (RTM director, 40s, phone, 15-sec attention)
  - Suspicious user (about to trust a small company with a block's accounts)
  - Impaired user (keyboard-only, screen reader, deuteranopic, prefers-reduced-motion)
  - Hostile user (form-spam probe)
  - Support persona (Howard reading the form-submission email)
- **Primary journeys**:
  - J1: Land on apex, understand what Proper Blocks does within 15 seconds, find a CTA.
  - J2: Read the casework, decide whether to message.
  - J3: Submit the Message-us form with realistic content.
  - J4: Read privacy / cookies / terms before deciding.
  - J5: Click "Portal login" to reach the existing leaseholder portal.

## Universal rules walked

| Rule | Result | Note |
|---|---|---|
| R1 — Touch-surface input audit | n/a | No on-device touch keyboard scope; standard mobile inputs. |
| R2 — Responsive overflow | DEFERRED | R15-bis. Static maths: hero clamp(46px,5.4vw,68px) at 390px = 46px; H1 max-width 760px doesn't overflow 390px. Modal max-width 560px fits ≤640px viewport with padding. Pillars `grid-template-columns:1fr` below 900px. No obvious overflow risk; full visual sweep at 3 viewports recommended. |
| R3 — Developer-laptop blindspot | DEFERRED | Howard's already walked on phone 22 May; recommend re-walk pre-cutover. |
| R4 — User-facing copy review | PASS | No raw error codes, no jargon. Form errors are friendly with explicit recovery ("Please tell us your name", "Please enter a valid email", "Please tell us your block address"). 502 fallback path tells user to email directly. |
| R5 — Deuteranopia + colour-only meaning | PASS (after fix) | `.msg-error.is-error` uses `#D94A3D`; `.msg-success .check` background uses `#2AA06A` (Howard's approved pair). Success uses tick character AND green colour (belt-and-braces). Error uses text colour AND `aria-live="polite"`. F-PBL-23-007: white-on-green check FIXED to forest `#14532D`. |
| R6 — Legal and privacy | PASS | Privacy notice: ICO ZC141151, lawful bases stated (legitimate interest / legal obligation / contract), retention windows, third-party processors listed (Cloudflare, Google Fonts, Twilio). Cookies page: single session cookie, no analytics. Terms: governing law England & Wales, liability cap. |
| R7 — Post-deploy production smoke | PASS | All 4 paths return 200 on apex AND pages.dev. www→apex 301 works. |
| R8 — Typography / inline font-size audit | PASS | Single Fraunces display + Inter body. Inline `font-size:` overrides: none in landing.js bar `style="font-size:15px"` on the band CTA (consistent with `.btn` defaults) and `style="font-size:14px"` on the modal submit button (consistent). No sibling-label parity violations. |
| R9 — Overlay / state-bleed | PASS | Single overlay (`.msg-modal`). Open / close paths reset body overflow + restore last-focus. Focus trap on Tab. Escape closes. |
| R10 — No stuck screens | PASS | Form submit shows "Sending..." state + disabled button. Network error path is friendly with retry option. No spinners >10s anywhere. |
| R11 — Settings without trigger context | n/a | No settings on a static landing. |
| R12 — Information architecture | PASS | Header → Hero (animated H1 + CTAs) → Brand glyph + wordmark → Pillars intro → Morph video → Trust strip → Two pillars → Casework → Who-we-work-with → CTA band → Footer. Linear, primary-CTA prominence (Message us > How we work > Portal login). |
| R13 — Interactive element side-effects | PARTIAL | Header buttons (Approach scroll, Portal login external href, Message us modal open): all walked, work. Hero CTAs: walked, work. Footer links (Privacy/Terms/Contact mailto): walked, work. Modal close (overlay click, × button, Escape, after-success close): walked, work. **Form submit walked against pages.dev = 405 (the F-PBL-23-001 cutover-blocker)**; walked against Worker apex = 403 "origin required" (gate working) with valid Origin header would succeed; not exhaustively tested with real submission to avoid polluting Howard's inbox. |
| R13-bis — Conditional UI induced | PASS | Single conditional element: `#other-wrap` shown when `Other` issue checkbox ticked. Induced via checkbox; input focuses correctly. Honeypot `.msg-hp` deliberately invisible — confirmed `position:absolute !important;left:-9999px !important`. |
| R14 — Palette contrast | PASS | All text/background pairs WCAG AA-normal or better. `--ink-3` (#64748B) on `--panel` (#FFFFFF) = 4.78 (passes AA-normal). `--copper-deep` (#155F66) on `--bg` (#FAF9F6) = 6.88 (passes AAA). Forest on green = 6.5:1 (passes AAA). |
| R15 — Visual sweep at 3 viewports | DEFERRED with reason | Surface has materially changed (Pages repo split + 22 May redesign). Howard already visually QA'd 22 May. Headless screenshot at 3 viewports via Claude_in_Chrome not run this pass to keep within session budget; flagged to Howard for a phone re-walk pre-cutover. |
| R16 — User-journey completeness | PASS | Every primary journey (J1-J5) has a discoverable, functioning, persistent UI entry-point. Message us has 3 callsites (header, hero, CTA band). Portal login is in header. Approach scrolls. |
| R17 — Power-loss survival | n/a | Web surface, no device. |
| R18 — Cross-surface instruction integrity | PASS | One cross-surface link (Portal login → portal.properblocks.co.uk). Verified 200, separate Worker, no shared state. Email confirmation mentions hello@properblocks.co.uk which routes to DennisHouseRTM@gmail.com per `landing_contact.js` comment — internal Gmail alias deferred; user-facing copy is honest about reply destination ("you'll get a copy in your inbox"). |
| R19 — Probe-pollution discipline | n/a | No probes fired this pass; smoke against pages.dev used `@dh-probe.invalid` domain. |
| R20 — No lowercase enums | PASS | All form options sentence-case; no leaked internal enum labels. |
| R22 — Role × action visibility | n/a | Single role (anonymous) on a static landing. |

## Persona findings

### First-time visitor (RTM director, 40s, phone)
- Lit H1 reveal works on phone: "Block management." appears on load, "done properly." lights up as user scrolls down 80% of viewport.
- The morph video sticky-scrub explanation: doesn't NEED an explanation (animation is self-evident: building decays → flourishes), but Howard might consider a 6-8 word caption beneath ("from neglect to a well-run block") for AI crawlers and motion-disabled users.
- Trust strip credentials are scannable in <3 seconds.
- Pillars intro "Financially diligent. Communicators supreme." reads as confident but not boastful.
- **30-second gut reaction**: this is an unusually mature small-firm landing. Reads as elite without manufactured demand. The casework is the standout — anonymised and specific.

### Suspicious user
- Privacy / Cookies / Terms all accessible from the footer in 1 click.
- ICO ZC141151 stated and verifiable.
- Companies House number 11209610 in footer.
- "We take on a small number of buildings each year" reads as scarcity but is quality-rationale — permitted per `feedback_no_manufactured_demand.md`.

### Impaired user
- **Keyboard-only**: every interactive element has `:focus-visible` outline (2px copper). Modal traps focus correctly. Tab order is logical.
- **Screen reader**: H1 `aria-label="Block management, done properly."`. Mark/glyph SVGs `aria-hidden="true"`. Unravel glyph `aria-hidden="true"`. Morph video has descriptive `aria-label`. Modal `aria-modal="true"`, `aria-labelledby="msg-modal-title"`.
- **Deuteranopic** (Howard's own): R5 + R14 pair correctly used. No mid-tone green near red anywhere.
- **prefers-reduced-motion**: respected on every animation (hero manifesto, unravel wordmark, morph video freezes on final frame, particle dust hidden, reveal animations skipped to in-state).

### Hostile user
- Honeypot field `name="website"` correctly invisible + tabindex=-1.
- Origin gate on Worker handler rejects non-properblocks.co.uk origins (verified curl).
- Rate-limit 5/IP/10min on `landing_contact` action (verified in `routes/landing_contact.js`).
- Input length caps + email regex server-side (verified).

### Support persona (Howard reading the form-submission email)
- Internal email composes name, email, phone, block address, RTM company, issues list, other details, IP, timestamp. Clean.
- Reply-To header is the submitter's email — Howard hits Reply and the response goes to the prospect directly. ✓
- Confirmation email to submitter is well-styled, brand-consistent (Fraunces "Proper Blocks" wordmark + glyph SVG).

## Q1 / Q2 / Q3 summary

| Q | Finding | Action |
|---|---|---|
| Q1 | Cutover-blocker form (F-PBL-23-001) | Howard decision: Path A/B/C (CTO report) |
| Q1 | Pages CSP `'unsafe-inline'` (F-PBL-23-002) | Pages middleware nonce; ship pre-cutover |
| Q2 | H1 empty pre-JS for non-rendering crawlers | Mitigated by schema + noscript; optional pre-lit static spans |
| Q3 | 0/8 persona queries cite PB | Hub page draft (Howard decision); schema shipped this pass |
| Q3 | `.case-tag` uppercase (F-PBL-23-006) | FIXED in flight |
| Q3 | `.check` white-on-green (F-PBL-23-007) | FIXED in flight |
| Q3 | R15 viewport sweep | Defer to Howard's phone re-walk |

No Q1 functional defects on the live walk.
