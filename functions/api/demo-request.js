// POST /api/demo-request - Pages Function that proxies the "Get a demo login"
// pop-up in the Portal section to the dennis-house-portal Worker over
// the same WORKER service binding as /api/landing-contact (see that file for
// why the binding exists and how it was wired).
//
// The Worker owns everything that matters: the 10-an-hour cap, the per-IP
// limit, the demo_requests table, making and emailing the login, and the
// heads-up to Howard. This
// Function only forwards the body, pins the Origin the Worker's guard expects,
// and carries the visitor's real IP so the per-IP limit keys on the visitor
// rather than the Pages edge.

const FALLBACK_ERROR = "We couldn't send that just now. Please email howard@properblocks.co.uk.";

function jsonError(status) {
  return new Response(JSON.stringify({ ok: false, error: FALLBACK_ERROR }), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' },
  });
}

export async function onRequestPost(context) {
  const { request, env } = context;
  if (!env.WORKER || typeof env.WORKER.fetch !== 'function') return jsonError(503);

  // This Function sets the Origin the Worker checks, so the visitor's own Origin
  // is checked here. JSON only: a cross-site page cannot send it without a
  // preflight, which this site never answers.
  const from = request.headers.get('origin');
  if (from && !/^https:\/\/(www\.)?properblocks\.co\.uk$/.test(from)) return jsonError(403);
  if (!/^application\/json\b/i.test(request.headers.get('content-type') || '')) return jsonError(415);

  const headers = new Headers();
  headers.set('content-type', 'application/json');
  headers.set('origin', 'https://properblocks.co.uk');
  const clientIp = request.headers.get('cf-connecting-ip') || request.headers.get('x-forwarded-for') || '';
  if (clientIp) headers.set('cf-connecting-ip', clientIp);

  const workerReq = new Request('https://properblocks.co.uk/api/demo-request', {
    method: 'POST',
    headers,
    body: await request.text(),
  });

  try {
    const workerRes = await env.WORKER.fetch(workerReq);
    const out = new Headers();
    const ct = workerRes.headers.get('content-type');
    if (ct) out.set('content-type', ct);
    out.set('cache-control', 'no-store');
    return new Response(workerRes.body, { status: workerRes.status, headers: out });
  } catch (err) {
    return jsonError(502);
  }
}
