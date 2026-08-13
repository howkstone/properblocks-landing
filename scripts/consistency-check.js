#!/usr/bin/env node
// Cross-page fact check for properblocks.co.uk.
//
// Why this exists: index/privacy/cookies/terms are generated from the DH repo's
// ui/*.js, but pricing, FAQs, block-manager-london and contractor are hand-
// maintained standalone HTML. Nothing else notices when the same fact is stated
// two different ways on two different pages. On 7 Aug 2026 the site was
// simultaneously claiming the smallest block it takes is 10 units and 20 units,
// that the fire risk assessment had been absent since 2017 and that it was
// months overdue, that inherited debtors ran 7 years and 10 years, and it named
// two different trading entities across five pages plus a company
// ("Big Brain Company Ltd") that does not exist at Companies House.
//
// Add a rule here the moment a fact starts appearing on more than one page.
// Run: node scripts/consistency-check.js   (build.js runs it automatically)

const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const PAGES = [
  "index.html",
  "pricing/index.html",
  "FAQs/index.html",
  "block-manager-london/index.html",
  "contractor/index.html",
  "privacy/index.html",
  "cookies/index.html",
  "terms/index.html",
];

const failures = [];

// Claims a marketing page may not make, because we cannot evidence them.
// Every entry here is a wording that actually shipped and had to be pulled.
const UNPROVABLE_CLAIMS = [
  {
    pattern: /nobody else (offers|does|can|provides)|no one else (offers|does|can|provides)|unbeatable|best in (class|london|the market)|the only (agent|manager|firm)/i,
    why: "says something about every competitor, which we have not checked and cannot check.",
  },
  {
    pattern: /orderly handover|handover is orderly|switch is orderly/i,
    why: "promises how the OUTGOING agent will behave, which is not ours to promise. Say managed handover.",
  },
  {
    pattern: /you can prove it|so you can prove/i,
    why: "promises the reader an outcome in a dispute. Say what the record contains instead.",
  },
  {
    // Howard, 12 Aug 2026: his body was CIMA, not ICAEW, and that membership
    // lapsed in 2012. Neither designation may appear until he is a reinstated
    // member in good standing, and CIMA's title is Chartered Management
    // Accountant, never "Chartered Accountant".
    pattern: /chartered accountant|ICAEW|Institute of Chartered Accountants|chartered management accountant|ACMA|FCMA/i,
    why: "claims a professional accountancy qualification that is not currently held.",
  },
  {
    pattern: /financial and operational (report|update)/i,
    why: "the quarterly report is expenditure only (Howard, 12 Aug 2026). Operational reporting is not committed to.",
  },
];

function fail(file, msg) {
  failures.push(`${file}: ${msg}`);
}

// A fact that must be stated identically wherever it is stated at all.
// `probe` decides whether the page talks about this fact; `required` is what it
// must then contain; `banned` are the stale or contradictory forms.
const FACTS = [
  {
    name: "residential fee",
    probe: /per flat,? per year|per flat per year/i,
    required: [/(£|&pound;)350/],
    banned: [],
  },
  {
    name: "commercial fee",
    probe: /commercial unit[\s\S]{0,200}?per unit,? per year|per commercial unit/i,
    required: [/(£|&pound;)150/],
    banned: [],
  },
  {
    name: "small-block minimum",
    probe: /minimum (annual )?fee|smallest block|minimum of (£|&pound;)/i,
    required: [/3,600/],
    banned: [
      /around 20 units or more/i,
      /From around 10 units upwards/i,
    ],
  },
  {
    name: "major works administration",
    probe: /major works administration|Section 20 consultation and running/i,
    required: [/\b3%/],
    banned: [/\b(10|12|15)% of the contract/i],
  },
  {
    // Howard, 12 Aug 2026: no reply-time promise on any marketing page. Naming
    // a number reads as "we will take that long", and the promise we make is
    // active communication instead. The two-working-day backstop stays in the
    // management agreement, which is a contract and is not one of these pages.
    name: "no reply-time promise on marketing pages",
    probe: /./,
    required: [],
    banned: [
      /answered within (one|two|three|\d+) working days?/i,
      /repl(y|ies) within (one|two|three|\d+) working days?/i,
      /respon(d|se) within (one|two|three|\d+) working days?/i,
      /within (one|two|three|\d+) working days? of (receipt|your)/i,
      /same day response/i,
    ],
  },
  {
    name: "site visit cadence",
    probe: /visits? (the |your )?(building|block|Property) (no less than|at least)/i,
    required: [/(at least|no less than) once a month|at least (once )?monthly/i],
    banned: [/quarterly basis/i],
  },
  {
    name: "inherited debtors casework",
    probe: /inherited service-charge debtors/i,
    required: [/ten years/i],
    banned: [/seven years/i],
  },
  {
    // Management Agreement cl 4.8 (read-only access to the accounting records).
    // The page states the access and nothing about how often the records are
    // brought up to date. Never promise a live or real-time picture.
    name: "director read-only accounts access",
    probe: /read-only (login|access) to the (block's |Property's )?(accounting|ledger)/i,
    // Howard, 8 Aug 2026: no cadence on the page. The guard is now only the
    // ban list below, which stops the opposite overclaim.
    required: [],
    banned: [
      /real[- ]?time/i,
      /reconcil\w*\s+(the accounts\s+)?weekly/i,
      /weekly\s+reconcil/i,
      /updated daily/i,
      /live picture/i,
    ],
  },
  {
    name: "fire risk assessment casework",
    probe: /Fire Risk Assessment (several months|on file)/i,
    required: [/several months overdue/i],
    banned: [/since 2017/i],
  },
];

for (const rel of PAGES) {
  const file = path.join(ROOT, rel);
  if (!fs.existsSync(file)) {
    fail(rel, "page missing");
    continue;
  }
  const html = fs.readFileSync(file, "utf8");
  // Prose only: drop scripts, styles and comments so a note to a developer is
  // never read as a claim to a leaseholder.
  const prose = html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<!--[\s\S]*?-->/g, " ");

  // --- entity identity -------------------------------------------------
  if (/Big Brain Company Ltd/.test(html)) {
    fail(rel, 'names "Big Brain Company Ltd", which is not a registered company. 11209610 is BIG BRAIN LTD.');
  }
  // Big Brain Ltd trades as Proper Blocks and is the contracting entity, so it
  // is the only company number that may appear anywhere on the site. Proper
  // Blocks Ltd (17301605) holds the brand and must stay dormant: naming it as
  // the trader would put the wrong company on the contract, outside the
  // professional indemnity policy and the ombudsman membership, and would end
  // its dormancy for the associated-company corporation tax limits.
  if (/Co\. No\. \d+/.test(html) && !/Co\. No\. 11209610/.test(html)) {
    fail(rel, "states a company number that is not Big Brain Ltd (11209610).");
  }
  if (/17301605/.test(html)) {
    fail(rel, "names Proper Blocks Ltd (17301605) as a trading entity. It holds the brand only.");
  }

  // --- house style -----------------------------------------------------
  if (prose.includes("—")) {
    fail(rel, "contains an em dash.");
  }

  // --- claims we cannot stand behind -----------------------------------
  // Howard, 12 Aug 2026, after four of these shipped: a marketing page may
  // only promise what we control and can evidence. Anything about a
  // competitor, an outgoing agent's conduct, or a reader's ability to prove
  // something is a claim we cannot keep.
  for (const claim of UNPROVABLE_CLAIMS) {
    if (claim.pattern.test(prose)) {
      fail(rel, `unprovable claim: ${claim.why} ${claim.pattern}`);
    }
  }

  // --- cross-page facts ------------------------------------------------
  for (const fact of FACTS) {
    for (const bad of fact.banned) {
      if (bad.test(prose)) fail(rel, `${fact.name}: stale or contradictory wording ${bad}`);
    }
    if (!fact.probe.test(prose)) continue;
    for (const need of fact.required) {
      if (!need.test(prose)) {
        fail(rel, `${fact.name}: page discusses it but does not carry the agreed figure ${need}`);
      }
    }
  }
}

if (failures.length) {
  console.error("consistency-check: FAILED");
  for (const f of failures) console.error("  - " + f);
  process.exit(1);
}
console.log(`consistency-check: OK (${PAGES.length} pages, ${FACTS.length} cross-page facts)`);
