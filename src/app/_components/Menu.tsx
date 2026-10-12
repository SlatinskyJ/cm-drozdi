'use client';

import { Button } from '@components/ui/button';
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from '@components/ui/dropdown-menu';
import Link from 'next/link';
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
		<DropdownMenu>
			<DropdownMenuTrigger asChild>
				<Button
					variant="primary"
					className="rounded-full bg-opacity-60 font-bold hover:bg-opacity-100"
				>
					Menu
				</Button>
			</DropdownMenuTrigger>
			<DropdownMenuContent>
				<DropdownMenuItem asChild>
					<Link href="/">Domů</Link>
				</DropdownMenuItem>
				<DropdownMenuItem asChild>
					<Link href="/events">Události</Link>
				</DropdownMenuItem>
				{isAdmin ? (
					<DropdownMenuItem asChild>
						<Link href="/members">Členové</Link>
					</DropdownMenuItem>
				) : null}
				<DropdownMenuItem onSelect={handleSignOut}>
					Odhlásit
				</DropdownMenuItem>
			</DropdownMenuContent>
		</DropdownMenu>
	);
}
