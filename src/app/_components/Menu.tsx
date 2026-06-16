'use client';

import { Button } from '@components/ui/Button';
import {
	Dropdown,
	DropdownItem,
	DropdownMenu,
	DropdownTrigger,
} from '@components/ui/Dropdown';
import { useRouter } from 'next/navigation';
import { signOut } from '~/lib/auth-client';
import { useIsAdmin } from '~/utils/permissions';

export default function Menu() {
	const router = useRouter();
	const isAdmin = useIsAdmin();

	async function handleSignOut() {
		await signOut();
		router.push('/login');
		router.refresh();
	}

	const signOutItem = (
		<DropdownItem key="signout" onPress={handleSignOut}>
			Odhlásit
		</DropdownItem>
	);

	return (
		<Dropdown>
			<DropdownTrigger>
				<Button
					color="primary"
					className="rounded-full bg-opacity-60 font-bold hover:bg-opacity-100"
				>
					Menu
				</Button>
			</DropdownTrigger>
			{isAdmin ? (
				<DropdownMenu>
					<DropdownItem key="home" href="/">
						Domů
					</DropdownItem>
					<DropdownItem key="events" href="/events">
						Události
					</DropdownItem>
					<DropdownItem key="members" href="/members">
						Členové
					</DropdownItem>
					{signOutItem}
				</DropdownMenu>
			) : (
				<DropdownMenu>
					<DropdownItem key="home" href="/">
						Domů
					</DropdownItem>
					<DropdownItem key="events" href="/events">
						Události
					</DropdownItem>
					{signOutItem}
				</DropdownMenu>
			)}
		</Dropdown>
	);
}
