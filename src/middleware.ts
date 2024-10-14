import { withAuth } from "next-auth/middleware";

export default withAuth({
  callbacks: {
    authorized: ({ req }) => {
      const sessionToken = req.cookies.get("next-auth.session-token");
      console.log(req.cookies);
      return !!sessionToken;
    },
  },
});

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|auth|favicon.ico|images|$).*)"],
};
