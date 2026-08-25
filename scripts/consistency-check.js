#!/usr/bin/env node
// Cross-page fact check for properblocks.co.uk.
//
// Why this exists: index/privacy/cookies/terms are generated from the DH repo's
// ui/*.js, but fees, FAQs and contractor are hand-
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
  "block-manager-london/index.html",
  "FAQs/index.html",
  "fees/index.html",
  "contractor/index.html",
  "privacy/index.html",
  "cookies/index.html",
  "terms/index.html",
  // Published, and the file AI assistants are pointed at by robots.txt. It
  // carries the same fee, casework and founder facts as the HTML pages and was
  // read by nothing until 13 Aug 2026.
  "llms.txt",
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
    pattern: /chartered accountant|\bICAEW\b|Institute of Chartered Accountants|chartered management accountant|\bACMA\b|\bFCMA\b/i,
    why: "claims a professional accountancy qualification that is not currently held.",
  },
  {
    // 13 Aug 2026: both fonts came from fonts.googleapis.com, which put two
    // DNS and TLS handshakes in front of the first paint. Real visitors saw
    // 2,624ms at the 75th percentile. They are self-hosted now, and any
    // third-party font host coming back would silently undo it.
    pattern: /fonts\.googleapis\.com|fonts\.gstatic\.com/i,
    why: "loads fonts from a third party, which blocks the first paint and leaks visitor IPs. Self-host them under /fonts/.",
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
    // 18 Aug 2026: 5%, not 3%. Dennis House pays 3% because Howard owns a flat
    // there, so that rate belongs to that block's own agreement and must never
    // be the published rate again.
    name: "major works administration",
    probe: /major works administration|Section 20 consultation and running/i,
    required: [/\b5%/],
    banned: [/\b3% (of|on) (the )?(works|major works|contract)/i, /\b3% administration/i,
             /\b(10|12|15)% of the contract/i],
  },
  {
    // Howard, 12 Aug 2026: no reply-time promise on any marketing page. Naming
    // a number reads as "we will take that long", and the promise we make is
    // active communication instead. Widened 17 Aug 2026 on his instruction -
    // it is not true and it is not a promise, so it now goes everywhere,
    // including the management agreement (Schedule 4's answer, phone-call and
    // emergency rows deleted, and clause 2.4's one-working-day deadline).
    name: "no reply-time promise on marketing pages",
    probe: /./,
    required: [],
    banned: [
      /answered within (one|two|three|\d+) working days?/i,
      /repl(y|ies) within (one|two|three|\d+) working days?/i,
      /respon(d|se) within (one|two|three|\d+) working days?/i,
      /within (one|two|three|\d+) working days? of (receipt|your)/i,
      /same day response/i,
      // The phrasings the 12 Aug list missed: "we answer everything in two
      // working days", "answered in 2 working days", "returned within one
      // working day", "attended the same day".
      /answer(s|ed)? (everything |all (enquiries|messages) )?(in|within) (one|two|three|\d+) working days?/i,
      /(returned|acknowledged|attended) (in|within) (one|two|three|\d+) working days?/i,
      /(attended|instructed) the same day/i,
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
    // Companies House, officer 2BsH7S4BJVDNZ_-mKm3M6pf9Lbk: appointed a director
    // of DENNIS HOUSE RTM COMPANY LTD (11620031) on 12 October 2018, not
    // resigned. Four pages said 2018 in their visible copy while the founder's
    // JSON-LD on the homepage said 2025 - the year Proper Blocks itself was set
    // up. Nothing noticed, because until 13 Aug 2026 this gate never read
    // structured data. A claim about how long somebody has done something is
    // exactly the kind a machine quotes back.
    name: "RTM director since 2018",
    // Anchored on "director since <year>", never on the words "RTM director"
    // alone: a page explaining what an RTM director does, or naming the
    // directors of an RTM company, is not making this claim and must not be
    // asked to carry a date.
    probe: /(RTM|right-to-manage company) director since/i,
    required: [/(RTM|right-to-manage company) director since 2018/i],
    banned: [/(RTM|right-to-manage company) director since (?!2018\b)\d{4}/i],
  },
  {
    // Restored to the site 14 Aug 2026 with the credentials band. A membership
    // number is the one fact on that band a board will actually type into the
    // ombudsman's own member search, so a stale or mistyped one is worse than
    // saying nothing. The probe fires only where the page claims OUR membership,
    // never where it signposts the ombudsman as a consumer route.
    name: "ombudsman membership number",
    probe: /ombudsman[\s\S]{0,80}?(membership|member no|scheme member)|((membership|member no)[\s\S]{0,80}?ombudsman)/i,
    required: [/T14754/],
    // Anchored on the claim, not on the shape of the string. `banned` is tested
    // on every page regardless of `probe`, so a bare /T\d{4,6}/ would fail the
    // build on any unrelated reference that happened to look like one, and a
    // gate that cries wolf gets weakened rather than obeyed.
    banned: [/(ombudsman|membership)[\s\S]{0,60}?\bT(?!14754\b)\d{4,6}\b/i],
  },
  {
    // The row was held off the site earlier on 14 Aug 2026 because the policy
    // underneath is the Hiscox TECHNOLOGY-COMPANIES professional indemnity
    // section (see memory/reference_bbl_insurance_position.md) and the broker
    // had not been asked whether it reaches block management for third-party
    // clients. Howard put it back the same day and is settling the scope with
    // the broker directly. The gate therefore guards the NUMBER: £500,000 is
    // the limit on the certificate (doc 372, policy PL-PSC10003948119/01), and
    // any other figure beside a professional indemnity claim fails the build.
    // Probe fires only where a page puts a MONEY figure against the claim (the
    // credentials band). The FAQ and London pages mention the cover with no
    // figure, which stays legitimate, so anchoring on the bare phrase would
    // fail the build on them.
    name: "professional indemnity cover figure",
    probe: /professional indemnity[\s\S]{0,80}?(£|&pound;)/i,
    required: [/(£|&pound;)\s?500,000/],
    banned: [/professional indemnity[\s\S]{0,120}?(£|&pound;)\s?(?!500,000)[\d,]+/i,
             /(£|&pound;)\s?(?!500,000)[\d,]+\s?(of cover)?[\s\S]{0,60}?professional indemnity/i],
  },
  {
    // Already on privacy, cookies and llms.txt before the band existed. One
    // registration, one number, and a wrong one is a false statement to the
    // regulator's own register.
    name: "ICO registration reference",
    probe: /ICO (reg\.?|reference|ZC)|registered with the (ICO|Information Commissioner)/i,
    required: [/ZC141151/],
    banned: [/\bZ(?!C141151\b)[A-Z]?\d{6,7}\b/],
  },
  {
    // Section 20 and major works are NOT in the annual fee. They are charged at
    // 5% of the contract value under Schedule 2 of the management agreement, and
    // the fees page listed "Section 20 consultation run properly" as an included
    // item from launch until 25 Aug 2026, when Howard caught it live. A prospect
    // reading that list was told the consultation was free and would have found
    // the 5% on the invoice. The banned pattern reads only INSIDE the included
    // list: it stops at the first closing tag of that list, so the separately
    // charged row further down the same page stays legitimate.
    name: "section 20 is never listed inside the annual fee",
    probe: /annual fee covers|what the fee (covers|includes)/i,
    required: [],
    banned: [/(annual fee covers|what the fee (covers|includes))(?:(?!<\/ul>)[\s\S])*?(section\s*20|major works)/i],
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
  // TWO TEXTS, AND THE DIFFERENCE MATTERS (13 Aug 2026).
  //
  // `prose` is what a reader sees: scripts, styles and comments dropped, so a
  // note to a developer is never read as a claim to a leaseholder. That is the
  // right scope for a house-style rule about words on a page.
  //
  // `published` is everything a reader OR A MACHINE is given: comments dropped
  // and nothing else, so JSON-LD, meta descriptions and titles are read. A claim
  // is published wherever it is published. Checking prose alone is how
  // "Chartered Accountant (ICAEW)" sat in the founder's structured data on
  // theken.uk for twelve weeks after the visible version came off the page -
  // six instances across two pages, invisible to a gate of exactly this shape.
  // Every claim and cross-page fact below therefore reads `published`.
  const prose = html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<!--[\s\S]*?-->/g, " ");
  const published = html
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

  // Howard, 14 Aug 2026: the serial comma is his house style and he uses it.
  // He caught a letter where his own "attention, responsiveness, and diligence"
  // had been silently reduced to the British-optional form; the site was then
  // found running fifteen lists without it. British style leaves it optional,
  // so this is a preference, and his preference wins on his own surfaces.
  //
  // SCOPE, deliberately narrow: only lists of four or more items, where two
  // commas are followed by a bare "and". The three-item form ("X, Y and Z")
  // shares its shape with ordinary two-item clauses ("the fee, quotable from
  // memory and published in full"), and a regex cannot tell them apart - it
  // returned 40 hits here, most of them not lists at all. Widening this rule
  // would make it noise, and a noisy gate gets ignored. Three-item lists are
  // governed by the writing rule in CLAUDE.md instead.
  const visible = prose.replace(/<[^>]+>/g, " ").replace(/&[a-z]+;/g, " ").replace(/\s+/g, " ");
  const SERIAL_COMMA_ALLOWED = [
    // Reviewed 14 Aug 2026 and NOT lists: each is a two-part clause that only
    // looks like one because a comma-separated aside sits in front of it.
    "vet, and chase, already in place and i",
    "roof, façade, structural Building safety and c",
    "per unit per year, usually plus VAT, plus an uplift on major works and a",
    "managing agent or contractor, provided the request is reasonable and t",
  ];
  for (const m of visible.matchAll(/[A-Za-z0-9][^,.;:!?()]{0,40}, [^,.;:!?()]{1,40}, [^,.;:!?()]{1,40} and [a-z]/g)) {
    // A window that already contains ", and " is a correctly-punctuated list
    // whose closing item happens to be followed by another "and" clause
    // ("every message, action, and response logged and visible"). The match
    // starts mid-list; the comma it wants is already there.
    if (m[0].includes(", and ")) continue;
    if (SERIAL_COMMA_ALLOWED.some(a => m[0].includes(a) || a.includes(m[0]))) continue;
    fail(rel, `list of four or more items with no serial comma before "and": "${m[0].trim()}". Howard's house style takes one. If it is not a list, add it to SERIAL_COMMA_ALLOWED with the reason.`);
  }

  // --- claims we cannot stand behind -----------------------------------
  // Howard, 12 Aug 2026, after four of these shipped: a marketing page may
  // only promise what we control and can evidence. Anything about a
  // competitor, an outgoing agent's conduct, or a reader's ability to prove
  // something is a claim we cannot keep.
  for (const claim of UNPROVABLE_CLAIMS) {
    if (claim.pattern.test(published)) {
      fail(rel, `unprovable claim: ${claim.why} ${claim.pattern}`);
    }
  }

  // --- cross-page facts ------------------------------------------------
  for (const fact of FACTS) {
    for (const bad of fact.banned) {
      if (bad.test(published)) fail(rel, `${fact.name}: stale or contradictory wording ${bad}`);
    }
    if (!fact.probe.test(published)) continue;
    for (const need of fact.required) {
      if (!need.test(published)) {
        fail(rel, `${fact.name}: page discusses it but does not carry the agreed figure ${need}`);
      }
    }
  }
}

// --- the commitments, off the site and on paper ------------------------
// The commitment labels live in three places: this site, the RTM outreach
// letters and the noticeboard notice. On 14 Aug 2026 the site relabelled one
// commitment and gained a tenth while both Word builders still carried the old
// wording, so a board could have been handed a letter that disagreed with the
// page it points at. The builders sit in OneDrive, outside this repo, so this
// runs only where they exist (a laptop, not CI) and says so when it skips.
// The mission reads "Our mission:" as a label and the rest as a quotation, so
// on the page it is split across elements and wrapped in curly quotes, while on
// paper it is one plain sentence. Compare the WORDS, not the markup: strip
// tags, quotes and punctuation, then look for the phrase. Checking the raw
// string would have passed the documents and failed the page it came from.
const MISSION_TEXT = "Our mission: to be the most transparent, effective, and honourable block manager in London, restoring trust to the industry.";
const MISSION_WORDS = /our mission,? to be the most transparent,? effective,? and honourable block manager in london,? restoring trust to the industry/;
function statesMission(src) {
  const flat = src
    .replace(/<[^>]+>/g, " ")
    .replace(/&[a-z]+;|&#\d+;/gi, " ")
    .replace(/[‘’“”"'`.:;!]/g, " ")
    .replace(/\s+/g, " ")
    .toLowerCase();
  return MISSION_WORDS.test(flat);
}

const BUILDERS = [
  "C:\\Users\\user\\OneDrive\\Documents\\Big Brain Ltd\\Proper Blocks Ltd\\Prospects\\builders\\build_pb_letters.py",
  "C:\\Users\\user\\OneDrive\\Documents\\Big Brain Ltd\\Proper Blocks Ltd\\Prospects\\builders\\build_pb_notice.py",
];
const indexFile = path.join(ROOT, "index.html");
let builderNote = "builders not present, skipped";
if (fs.existsSync(indexFile)) {
  const siteLabels = [...fs.readFileSync(indexFile, "utf8")
    .matchAll(/<span class="deliver-label">([^<]+)<\/span>/g)].map(m => m[1].trim());
  const indexSrc = fs.readFileSync(indexFile, "utf8");
  if (!statesMission(indexSrc)) {
    fail("index.html", "does not carry the mission line exactly: " + MISSION_TEXT);
  }
  if (siteLabels.length) {
    const present = BUILDERS.filter(f => fs.existsSync(f));
    for (const f of present) {
      const src = fs.readFileSync(f, "utf8");
      // Read ONLY the commitment list (PROMISES in the letters, SIX in the
      // notice). Both files carry other tuple lists - block names, addresses -
      // and a regex loose enough to catch those turns the gate into noise.
      const block = (src.match(/^(?:PROMISES|SIX)\s*=\s*\[([\s\S]*?)^\]/m) || [])[1];
      if (!block) {
        fail(path.basename(f), "no PROMISES/SIX commitment list found - the gate cannot see the labels.");
        continue;
      }
      // Each commitment is a ("Label.", " explanation") tuple. Take the first
      // string of each tuple, drop the trailing full stop, and require the site
      // to carry the same label.
      const labels = [...block.matchAll(/\(\s*"([^"]{12,90}?)\.?\s*",\s*\n?\s*"/g)]
        .map(m => m[1].replace(/\.$/, "").trim())
        .filter(l => /^[A-Z]/.test(l) && !l.includes("://"));
      const norm = t => t.replace(/,? in force$/, "");
      for (const label of labels) {
        if (!siteLabels.some(s => norm(s) === norm(label))) {
          fail(path.basename(f), `commitment "${label}" is not on the site. Change one, change all.`);
        }
      }
      // ORDER, not just presence (15 Aug 2026). Presence alone passed while the
      // site, the letters and the notice each ran a different order: the site
      // put monthly visits second, the letter buried it eighth, and the notice
      // led on it. A reader who takes the notice off the wall, scans the QR and
      // is later posted a letter meets the same ten promises ranked three ways,
      // which reads as three different firms. The paper is a SUBSET of the site
      // (the notice carries six), so the test is that the labels it does carry
      // appear in the site's relative order.
      const rank = labels.map(l => siteLabels.findIndex(s => norm(s) === norm(l)));
      for (let i = 1; i < rank.length; i++) {
        if (rank[i - 1] === -1 || rank[i] === -1) continue;
        if (rank[i] < rank[i - 1]) {
          fail(path.basename(f), `"${labels[i]}" is promoted above "${labels[i - 1]}" here, and below it on the site. One order, everywhere.`);
          break;
        }
      }

      // CREDENTIALS, all three or none (15 Aug 2026). Howard: "I told you to
      // include insurance, please restore everywhere." The letters carried the
      // ten commitments and no registrations at all while the site and the
      // notice both showed them, so a posted letter made a weaker firm of us
      // than the sheet on the wall. Any outbound paper that names one of the
      // three must name all three, with the site's own figures.
      const creds = [
        ["The Property Ombudsman number", /T14754/],
        ["the ICO registration", /ZC141151/],
        ["the professional indemnity cover", /(£|&pound;)\s?500,000|£500k/],
      ];
      const shown = creds.filter(([, re]) => re.test(src));
      if (shown.length && shown.length < creds.length) {
        const missing = creds.filter(([, re]) => !re.test(src)).map(([n]) => n);
        fail(path.basename(f), `carries some registrations but not ${missing.join(" or ")}. All three, on every piece of paper that leaves us.`);
      } else if (!shown.length) {
        fail(path.basename(f), "carries no registrations at all. The Ombudsman number, the ICO reference and the indemnity cover go on everything we send out.");
      }

      // THE MISSION LINE, word for word. Howard dictated it on 20 Aug 2026 as
      // "to be the most transparent, effective, and honourable block manager in
      // London, restoring trust to the industry", replacing the 18 Aug wording
      // ("the most effective and honourable block manager in London"). Before
      // that the site carried "honourable and effective ... block managers", so
      // the page and the paper stated the mission differently. One wording, on
      // all three surfaces, or this fails.
      if (!statesMission(src)) {
        fail(path.basename(f), "does not carry the mission line exactly: " + MISSION_TEXT);
      }
    }
    builderNote = present.length ? `${present.length} builders checked` : builderNote;
  }
}

// ---------------------------------------------------------------------------
// FORM CONTROLS (15 Aug 2026). Howard: the "how did you hear about us?" field
// was "ugly ... a lazy implementation". The enquiry form styled input, email,
// tel and textarea by name and never added select, so one control kept the
// browser's 19px grey OS dropdown while its six neighbours were 44px, rounded
// and on-brand. Naming control types one at a time is what let it happen, so
// the gate now checks the rendered page: every control the form contains has
// to appear in the field rule and in the focus rule. A new control type fails
// here rather than shipping unstyled.
// Rule: memory/feedback_one_control_is_painted_in_one_place.md
if (fs.existsSync(indexFile)) {
  const html = fs.readFileSync(indexFile, "utf8");
  const form = (html.match(/<form id="msg-modal-form"[\s\S]*?<\/form>/) || [])[0];
  if (!form) {
    fail("index.html", "the enquiry form is gone - the control gate cannot see it.");
  } else {
    // What the form actually contains, as CSS selectors.
    const used = new Set();
    for (const m of form.matchAll(/<input[^>]*type=["']?([a-z]+)/g)) {
      if (!["checkbox", "radio", "hidden", "submit"].includes(m[1])) used.add(`input[type=${m[1]}]`);
    }
    if (/<textarea/.test(form)) used.add("textarea");
    if (/<select/.test(form)) used.add("select");

    const ruleFor = re => (html.match(re) || [])[0] || "";
    const fieldRule = ruleFor(/#msg-modal-form input\[type=text\][^{]*\{[^}]*border-radius[^}]*\}/);
    const focusRule = ruleFor(/#msg-modal-form input:focus[^{]*\{[^}]*\}/);
    if (!fieldRule) fail("index.html", "the shared enquiry-field rule is gone; controls would fall back to the browser's own styling.");
    if (!focusRule) fail("index.html", "the shared enquiry-focus rule is gone; controls would lose the focus ring.");

    for (const sel of used) {
      // The honeypot is deliberately off-screen and unstyled.
      if (fieldRule && !fieldRule.includes(sel)) {
        fail("index.html", `the enquiry form has a ${sel} the field styling does not cover, so it renders as a raw browser control next to branded ones.`);
      }
      const focusSel = sel.startsWith("input") ? "input:focus" : sel + ":focus";
      if (focusRule && !focusRule.includes(focusSel)) {
        fail("index.html", `the enquiry form's ${sel} gets no focus ring, so a keyboard user cannot see where they are.`);
      }
    }
    // A select with no chevron is the OS dropdown wearing our border.
    if (used.has("select") && !/#msg-modal-form select\{[^}]*appearance:none[^}]*background-image:url/.test(html)) {
      fail("index.html", "the enquiry form's dropdown has no chevron of ours; it falls back to the operating system's arrow.");
    }
    // The `background` shorthand resets background-image. In a :focus or
    // :hover rule that lands on a control carrying a chevron, that wipes the
    // chevron the instant the control is used - which is exactly when the
    // user is looking at it. Seen live 16 Aug 2026; background-color only.
    for (const m of html.matchAll(/#msg-modal-form[^{]*(?::focus|:hover)[^{]*\{([^}]*)\}/g)) {
      if (/(^|;)\s*background\s*:/.test(m[1])) {
        fail("index.html", "an enquiry-form focus or hover rule uses the background shorthand, which erases the dropdown's chevron while it is in use. Use background-color.");
      }
    }
    // Controls patched inline cannot be measured by this gate at all.
    const inlineCtl = [...form.matchAll(/<(?:button|select|input|textarea)[^>]*\sstyle="/g)];
    if (inlineCtl.length) {
      fail("index.html", `${inlineCtl.length} control(s) in the enquiry form are styled inline instead of by class, so nothing can check how they look.`);
    }
  }
}

// ---- Every internal link has to land somewhere ---------------------------
// A page linking to a URL this project does not serve is a 404 in front of a
// customer, and nothing else notices: a redirect can be retired, a page can be
// renamed, and the link that pointed at it just rots. Checked against the
// built output and the redirect table, so the answer is what Cloudflare will
// actually serve.
{
  const redirects = fs.readFileSync(path.join(ROOT, "_redirects"), "utf8")
    .split("\n").filter(Boolean)
    .map(l => l.trim().split(/\s+/)[0])
    .filter(p => p.startsWith("/"))
    .map(p => p.replace(/\*$/, ""));

  const serves = (url) => {
    const clean = url.split("#")[0].split("?")[0];
    if (clean === "" || clean === "/") return true;
    const rel = clean.replace(/^\//, "").replace(/\/$/, "");
    if (fs.existsSync(path.join(ROOT, rel, "index.html"))) return true;
    if (fs.existsSync(path.join(ROOT, rel))) return true;
    return redirects.some(r => clean === r || (r.endsWith("/") && clean.startsWith(r)));
  };

  for (const rel of PAGES) {
    const file = path.join(ROOT, rel);
    if (!fs.existsSync(file)) continue;
    const html = fs.readFileSync(file, "utf8");
    const seen = new Set();
    for (const m of html.matchAll(/href="(\/[^"]*)"/g)) {
      const href = m[1];
      if (seen.has(href)) continue;
      seen.add(href);
      if (!serves(href)) fail(rel, `links to ${href}, which this site does not serve.`);
    }
  }
}

if (failures.length) {
  console.error("consistency-check: FAILED");
  for (const f of failures) console.error("  - " + f);
  process.exit(1);
}
console.log(`consistency-check: OK (${PAGES.length} pages, ${FACTS.length} cross-page facts, ${builderNote})`);
