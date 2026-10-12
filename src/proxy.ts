import { getSessionCookie } from 'better-auth/cookies';
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// Optimistic gate: only checks that a Better Auth session cookie is present
// (getSessionCookie handles both the plain and the HTTPS `__Secure-` name).
// It does not validate the session. Real checks happen in the events/members
// layouts (auth.api.getSession) and in protectedProcedure. Keep this file free
// of DB, env and server imports: it runs on every matched request.
export default function proxy(req: NextRequest) {
	if (!getSessionCookie(req)) {
		return NextResponse.redirect(new URL('/login', req.url));
	}
	return NextResponse.next();
}

export const config = {
	matcher: [
		'/((?!api|_next/static|_next/image|auth|login|reset-password|favicon.ico|images|sitemap.xml|robots.txt|$).*)',
	],
};
