/*
 * Edge Middleware — the real lock.
 *
 * This runs on Vercel's edge BEFORE any file is served. Without the passcode
 * the HTML is never sent, so the app's features, prompts and UI are not
 * readable from source, devtools, or view-source. That is the difference
 * between this and an in-page overlay, which only hides a page already
 * delivered to the visitor.
 *
 * Setup (required):
 *   Vercel > this project > Settings > Environment Variables
 *   Add  SITE_PASSCODE = <your passcode>   for Production (and Preview).
 *   Redeploy. Any username works at the prompt; only the password is checked.
 *
 * Keep this passcode different from MOTM's. The two apps are deliberately
 * independent and should not share a secret.
 *
 * If SITE_PASSCODE is missing this fails CLOSED (401) rather than quietly
 * serving the site to everyone — an unset secret should never mean "public".
 */

export const config = {
  // Guard everything except Vercel's own internal endpoints.
  matcher: ['/((?!_vercel/).*)']
};

// Constant-time compare: a plain === leaks length/prefix through timing.
function safeEqual(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string') return false;
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

function challenge(message) {
  return new Response(message, {
    status: 401,
    headers: {
      'WWW-Authenticate': 'Basic realm="OCTAGON", charset="UTF-8"',
      'Cache-Control': 'no-store, must-revalidate',
      'Content-Type': 'text/plain; charset=utf-8'
    }
  });
}

export default function middleware(request) {
  const expected = process.env.SITE_PASSCODE;

  if (!expected) {
    return challenge(
      'Locked: SITE_PASSCODE is not set for this deployment.\n' +
      'Set it in Vercel > Settings > Environment Variables, then redeploy.'
    );
  }

  const header = request.headers.get('authorization') || '';
  if (header.startsWith('Basic ')) {
    try {
      const decoded = atob(header.slice(6));
      const supplied = decoded.slice(decoded.indexOf(':') + 1);
      if (safeEqual(supplied, expected)) return; // pass through
    } catch (e) {
      // malformed header falls through to the challenge
    }
  }

  return challenge('OCTAGON is private.');
}
