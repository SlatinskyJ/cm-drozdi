import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// Avoid importing better-auth/cookies here — its jose dependency pulls in
// CompressionStream which is not available in the Edge Runtime. A plain cookie
// presence check is all the middleware needs; actual session validation happens
// in server components via auth.api.getSession.
const SESSION_COOKIE = 'better-auth.session_token';

export default function middleware(req: NextRequest) {
	const sessionCookie = req.cookies.get(SESSION_COOKIE);
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
