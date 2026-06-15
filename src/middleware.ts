import { getSessionCookie } from 'better-auth/cookies';
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export default function middleware(req: NextRequest) {
	const sessionCookie = getSessionCookie(req);
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
