import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// Avoid importing better-auth/cookies here — its jose dependency pulls in
// CompressionStream which is not available in the Edge Runtime. A plain cookie
// presence check is all the middleware needs; actual session validation happens
// in server components via auth.api.getSession.
//
// Better Auth secure-prefixes the cookie name (`__Secure-...`) whenever the
// request is HTTPS, which is true on every Vercel deployment (preview and
// prod) but not on local `http://localhost:3000` dev — so both names must be
// checked here.
const SESSION_COOKIE = 'better-auth.session_token';
const SECURE_SESSION_COOKIE = `__Secure-${SESSION_COOKIE}`;

export default function middleware(req: NextRequest) {
	const sessionCookie =
		req.cookies.get(SESSION_COOKIE) ?? req.cookies.get(SECURE_SESSION_COOKIE);
	if (!sessionCookie) {
		return NextResponse.redirect(new URL('/login', req.url));
	}
	return NextResponse.next();
}

export const config = {
	matcher: [
		'/((?!api|_next/static|_next/image|auth|login|reset-password|favicon.ico|images|sitemap.xml|robots.txt|$).*)',
	],
};
