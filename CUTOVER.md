# Cutover runbook: properblocks.co.uk Worker → Pages

Drafted 2026-05-22. Run when you're ready. Expect 30-90 seconds of
visitor-facing unreachability during step 4-5; do it outside UK business
hours if you can.

## Before you start

- This repo is pushed to `howkstone/properblocks-landing` on `main`.
- The Pages project `properblocks-landing` exists (or you create it in step 2).
- The DH Worker source has the `properblocks.co.uk` + `www.properblocks.co.uk`
  route lines still in `wrangler.toml`. Step 4 removes them.
- **Pages service binding to the DH Worker is wired** (step 1.5 below).
  Without this, `functions/api/landing-contact.js` returns 503 and the
  Message-us form on the live site silently fails. **Do not skip.**

## Step 1 - confirm Pages preview renders

In the Cloudflare dashboard, the Pages project should be auto-deploying from
this repo. Check the latest deployment is green and visit
`https://properblocks-landing.pages.dev/` (or whatever the assigned
`*.pages.dev` URL is). Verify:

```
curl -sI https://properblocks-landing.pages.dev/ | head -3
curl -sI https://properblocks-landing.pages.dev/privacy/ | head -3
curl -sI https://properblocks-landing.pages.dev/brand/morph.mp4 -H "Range: bytes=0-1023" | head -5
```

Expect 200 (or 206 with `Content-Range` on the third). If the morph video
returns 200 with the full body instead of 206 partial, check Pages settings -
Range should be on by default.

## Step 1.5 - wire the service binding (one-time)

Cloudflare dashboard → Pages → `properblocks-landing` → Settings → Functions
→ Service bindings → Add binding:

- Variable name: `WORKER`
- Service: `dennis-house-portal`
- Environment: `production`

Save. The next Pages deploy picks the binding up; you can confirm by
visiting `https://properblocks-landing.pages.dev/api/landing-contact` with
a POST containing an empty JSON body — the response should be `400 invalid
body` (the Worker's validation), not `503` (the Pages fallback when the
binding is unwired). Cmd:

```
curl -i -X POST https://properblocks-landing.pages.dev/api/landing-contact \
  -H "content-type: application/json" \
  -H "origin: https://properblocks-landing.pages.dev" \
  -d '{}'
```

A `400` or `403 origin not allowed` response confirms the binding is live.
A `503` response means the binding is missing.

## Step 2 - if the Pages project does not exist yet

In the Cloudflare dashboard:

1. Workers & Pages → Create → Pages → Connect to Git
2. Authorise (already done for theken, eatcrimp, skyspiracy)
3. Pick `howkstone/properblocks-landing`, branch `main`
4. Build command: empty. Build output directory: `/` (root).
5. Project name: `properblocks-landing`
6. Save. First deploy fires automatically.

## Step 3 - pre-stage the rollback branch on DH

Open a terminal and run:

```
cd ~/dennis-house-portal
git checkout -b rollback-properblocks-pages-cutover
# don't push - just sits there ready
git checkout master
```

You'll only need this if step 5 finds a bug.

## Step 4 - the dangerous window starts here

Keep this under 90 seconds. Have two terminals open and the Pages dashboard
ready before you start.

Terminal A - DH Worker route removal:

```
cd ~/dennis-house-portal
# Edit wrangler.toml: delete the two lines for
#   { pattern = "properblocks.co.uk", custom_domain = true },
#   { pattern = "www.properblocks.co.uk", custom_domain = true },
# Leave portal.properblocks.co.uk, bigbraincompany.co.uk, www.bigbraincompany.co.uk.
```

Then delete the dead code in `worker.js`:
- the `LANDING_HTML`, `PRIVACY_HTML`, `COOKIES_HTML`, `TERMS_HTML` imports at the top
- the entire `if (isLandingHost) { ... }` block around lines 506-583
- the `isLandingHost` definition wherever it's defined

Then commit + deploy:

```
git add wrangler.toml worker.js
git commit -m "config: remove properblocks.co.uk landing routes (moved to Pages)"
git push origin master

# pre-deploy gates
# /code-review and security-review on the staged diff in Claude Code,
# then touch .gates-passed-$(git rev-parse HEAD)
bash deploy.sh
```

The moment wrangler reports `Uploaded dennis-house-portal`, the apex + www
return 522 / NXDOMAIN. Cloudflare has released the custom-domain claim.

## Step 5 - immediately attach custom domains on Pages

In Cloudflare dashboard, on the `properblocks-landing` Pages project:

1. Custom domains → Set up a custom domain → `properblocks.co.uk`. Cloudflare
   creates the DNS record automatically.
2. Add another → `www.properblocks.co.uk`. Same.
3. Wait for the green tick (10-60 seconds inside Cloudflare's zone).

## Step 6 - verify

```
curl -sI https://properblocks.co.uk/ | head -5
curl -sI https://www.properblocks.co.uk/ | head -5
curl -sI https://properblocks.co.uk/brand/morph.mp4 -H "Range: bytes=0-1023" | head -5
curl -sI https://portal.properblocks.co.uk/ | head -3
curl -s  https://properblocks.co.uk/robots.txt
```

Expectations:
- apex: 200, no `cf-worker` header, asset paths render
- www: 301 to apex
- morph.mp4: 206 with Content-Range
- portal: 200 (still Worker - unaffected)
- robots.txt: the new content

Visit the apex in an incognito window + DevTools Network: the scroll-driven
morph video should scrub smoothly. No console errors.

## Rollback (under 5 minutes)

If the Pages site has a bug:

1. Cloudflare dashboard → Pages project `properblocks-landing` → Custom
   domains → Remove both `properblocks.co.uk` and `www.properblocks.co.uk`.
2. In `dennis-house-portal`:
   ```
   git revert HEAD --no-edit
   git push origin master
   bash deploy.sh
   ```
   The Worker re-claims the two custom domains; DNS auto-reverts. Same
   ~60-90 second window.

## Done state

- `properblocks.co.uk` and `www.properblocks.co.uk` served by Pages from
  this repo. Push to `main` auto-deploys.
- `portal.properblocks.co.uk` still served by the DH Worker.
- `bigbraincompany.co.uk` legacy umbrella still served by the DH Worker.
- The DH Worker no longer carries landing-page code or the `isLandingHost`
  branch. Bundle is slightly smaller; portal cold-start fractionally faster.
