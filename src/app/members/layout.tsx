import { type ReactNode } from 'react';
import { redirect } from 'next/navigation';
import AccessForbiddenPage from '~/app/_components/AccessForbidden';
import { UserRole } from '~/enums/UserRole';
import { getServerAuthSession } from '~/server/auth';

export default async function MembersLayout({
	children,
}: Readonly<{ children: ReactNode }>) {
	const session = await getServerAuthSession();

	if (!session) redirect('/login');
	if (session.user.role !== UserRole.ADMIN) {
		return <AccessForbiddenPage />;
	}

	return <>{children}</>;
}
