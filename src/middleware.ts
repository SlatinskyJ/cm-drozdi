import { withAuth } from 'next-auth/middleware';

export default withAuth({
	callbacks: {
		authorized: ({ req }) => {
			const sessionToken =
				req.cookies.get('next-auth.session-token') ??
				req.cookies.get('__Secure-next-auth.session-token');
			return !!sessionToken;
		},
	},
});

export const config = {
	matcher: [
		'/((?!api|_next/static|_next/image|auth|favicon.ico|images|sitemap.xml|robots.txt|$).*)',
	],
};
