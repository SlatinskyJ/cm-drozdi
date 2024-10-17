import { GeistSans } from "geist/font/sans";
import { type ReactNode } from "react";
import AccessForbiddenPage from "~/app/_components/AccessForbidden";
import { UserRole } from "~/enums/UserRole";
import { getServerAuthSession } from "~/server/auth";

export default async function EventsLayout({
  children,
}: Readonly<{ children: ReactNode }>) {
  const session = await getServerAuthSession();

  if (session?.user.role === UserRole.GUEST) {
    return <AccessForbiddenPage />;
  }

  return <div className={GeistSans.className}>{children}</div>;
}
