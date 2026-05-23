// POST /api/landing-contact - Pages Function that proxies the marketing-site
// Message-us form submission to the dennis-house-portal Worker via a
// Cloudflare service binding.
//
// Closes CTO finding F-PBL-23-001 (Pages cutover blocker: Pages had no
// /api/landing-contact handler so the form returned 405 post-cutover).
//
// Architecture (Path C - service binding):
//   Browser → Pages (this Function) → service-binding RPC → DH Worker
//
// The DH Worker continues to own the email + D1 + audit + Gmail OAuth
// secrets. This Function is a thin shim that:
//   1. Forwards the POST body unchanged.
//   2. Synthesises a Worker-compatible Request URL on
//      https://properblocks.co.uk/api/landing-contact so the Worker's
//      Host-routing (isLandingHost branch around worker.js:506) picks the
//      correct handler.
//   3. Preserves the client IP via cf-connecting-ip so the Worker's
//      rate-limit table sees the real visitor IP, not the Pages edge IP.
//   4. Returns the Worker's response verbatim.
//
// Service-binding configuration (Howard, one-time):
//   Cloudflare dashboard → Pages → properblocks-landing → Settings
//     → Functions → Service bindings → Add
//   Variable name: WORKER
//   Service: dennis-house-portal
//   Environment: production
//
// Until the binding is wired the Function returns a 503 with a friendly
// error directing the user to email hello@properblocks.co.uk - degrades
// gracefully rather than 500ing.

export async function onRequestPost(context) {
  const { request, env } = context;

  if (!env.WORKER || typeof env.WORKER.fetch !== 'function') {
    return new Response(
      JSON.stringify({
        ok: false,
        error: "We couldn't send your message right now. Please email hello@properblocks.co.uk directly and we'll reply within one working day.",
      }),
      {
        status: 503,
        headers: {
          'content-type': 'application/json; charset=utf-8',
          'cache-control': 'no-store',
        },
      }
    );
  }

  // Reconstruct the request for the Worker so worker.js's host-router lands
  // on the isLandingHost branch (properblocks.co.uk + /api/landing-contact).
  const workerUrl = new URL('/api/landing-contact', 'https://properblocks.co.uk');

  // Copy through the headers the Worker handler relies on. Strip everything
  // else - the Pages edge adds headers (cf-ray, cf-pages-version, etc.) that
  // the Worker doesn't need and that would surprise downstream rate-limit /
  // audit-log readers.
  const forwardHeaders = new Headers();
  forwardHeaders.set('content-type', request.headers.get('content-type') || 'application/json');
  // Origin must match what the Worker's CSRF check expects (properblocks.co.uk).
  // The original Origin header was from the user's browser to Pages; the
  // Worker handler's regex (routes/landing_contact.js line 45) accepts only
  // https://properblocks.co.uk and https://www.properblocks.co.uk.
  forwardHeaders.set('origin', 'https://properblocks.co.uk');
  // Preserve the real client IP so the Worker's rate_limits table keys on
  // the visitor's IP, not the Pages edge IP. Service binding does NOT
  // automatically propagate cf-connecting-ip; we set it explicitly.
  const clientIp = request.headers.get('cf-connecting-ip')
    || request.headers.get('x-forwarded-for')
    || '';
  if (clientIp) {
    forwardHeaders.set('cf-connecting-ip', clientIp);
  }

  const body = await request.text();

  const workerReq = new Request(workerUrl.toString(), {
    method: 'POST',
    headers: forwardHeaders,
    body,
  });

  try {
    const workerRes = await env.WORKER.fetch(workerReq);

    // Pass response body + status through. Strip transport-layer headers
    // the Worker may set (content-encoding, content-length) - the runtime
    // recomputes them. Keep content-type and cache-control.
    const passThrough = new Headers();
    const ct = workerRes.headers.get('content-type');
    if (ct) passThrough.set('content-type', ct);
    passThrough.set('cache-control', 'no-store');

    return new Response(workerRes.body, {
      status: workerRes.status,
      headers: passThrough,
    });
  } catch (err) {
    // Service binding RPC failure - rare but graceful degrade.
    return new Response(
      JSON.stringify({
        ok: false,
        error: "We couldn't send your message right now. Please email hello@properblocks.co.uk directly and we'll reply within one working day.",
      }),
      {
        status: 502,
        headers: {
          'content-type': 'application/json; charset=utf-8',
          'cache-control': 'no-store',
        },
      }
    );
  }
}

// Non-POST methods: no handler is exported, so Pages returns 404. robots.txt
// disallows /api/ on every crawler so probes shouldn't reach this. An explicit
// onRequest catch-all was considered and rejected: Pages' method-resolution
// for catch-all + method-specific exports is opaque enough that the safer
// route is to let Pages return 404 for unhandled methods.
