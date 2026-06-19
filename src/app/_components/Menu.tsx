'use client';

import { Button } from '@components/ui/button';
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

	return (
		<Dropdown>
			<DropdownTrigger>
				<Button
					variant="primary"
					className="rounded-full bg-opacity-60 font-bold hover:bg-opacity-100"
				>
					Menu
				</Button>
			</DropdownTrigger>
			<DropdownMenu>
				<DropdownItem key="home" href="/">
					Domů
				</DropdownItem>
				<DropdownItem key="events" href="/events">
					Události
				</DropdownItem>
				{isAdmin ? (
					<DropdownItem key="members" href="/members">
						Členové
					</DropdownItem>
				) : null}
				<DropdownItem key="signout" onPress={handleSignOut}>
					Odhlásit
				</DropdownItem>
			</DropdownMenu>
		</Dropdown>
	);
}
