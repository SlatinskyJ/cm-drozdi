import { type ReactNode } from "react";
import AccessForbiddenPage from "~/app/_components/AccessForbidden";
import { getServerAuthSession } from "~/server/auth";
import { UserRole } from "~/server/enums/UserRole";

export default async function EventsLayout({
  children,
}: Readonly<{ children: ReactNode }>) {
  const session = await getServerAuthSession();

  if (session?.user.role === UserRole.GUEST) {
    return <AccessForbiddenPage />;
  }

  return children;
}
