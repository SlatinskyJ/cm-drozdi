import { authClient } from '~/lib/auth-client';
import { UserRole } from '~/enums/UserRole';

export function useIsAdmin(): boolean {
	const { data } = authClient.useSession();
	return (data?.user.role as UserRole) === UserRole.ADMIN;
}
