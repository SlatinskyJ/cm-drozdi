'use client';

import { Button } from '@components/ui/Button';
import toast from 'react-hot-toast';
import { UserRole } from '~/enums/UserRole';
import { api } from '~/trpc/react';
import { CreateMemberForm } from '~/app/members/_components/CreateMemberForm';

const ASSIGNABLE: { label: string; value: UserRole }[] = [
	{ label: 'Člen', value: UserRole.MEMBER },
	{ label: 'Admin', value: UserRole.ADMIN },
];

export default function MembersPage() {
	const utils = api.useUtils();
	const list = api.member.list.useQuery();
	const setRoleMut = api.member.setRole.useMutation({
		onSuccess: () => utils.member.list.invalidate(),
		onError: (e) => toast.error(e.message),
	});
	const del = api.member.delete.useMutation({
		onSuccess: () => utils.member.list.invalidate(),
		onError: (e) => toast.error(e.message),
	});
	const genLink = api.member.generatePasswordLink.useMutation({
		onError: (e) => toast.error(e.message),
	});

	async function copyLink(userId: string) {
		const { url } = await genLink.mutateAsync({ userId });
		await navigator.clipboard.writeText(url);
		toast.success('Odkaz zkopírován.');
	}

	return (
		<div className="mx-auto max-w-3xl p-6">
			<h1 className="mb-4 text-2xl font-bold">Členové</h1>

			<CreateMemberForm />

			<table className="w-full text-left">
				<thead>
					<tr>
						<th>Jméno</th>
						<th>E-mail</th>
						<th>Role</th>
						<th>Akce</th>
					</tr>
				</thead>
				<tbody>
					{list.data?.map((m) => (
						<tr key={m.id} className="border-t">
							<td>{m.name}</td>
							<td>{m.email}</td>
							<td>
								<select
									value={m.role}
									onChange={(e) =>
										setRoleMut.mutate({
											userId: m.id,
											role: e.target.value as UserRole,
										})
									}
									className="rounded border px-2 py-1"
								>
									{ASSIGNABLE.map((r) => (
										<option key={r.value} value={r.value}>
											{r.label}
										</option>
									))}
								</select>
								{!m.hasPassword && (
									<span className="ml-2 rounded bg-yellow-200 px-2 py-0.5 text-xs text-yellow-900">
										čeká na heslo
									</span>
								)}
							</td>
							<td className="flex gap-2">
								<Button
									onClick={() => copyLink(m.id)}
									isLoading={genLink.isPending}
								>
									Kopírovat odkaz
								</Button>
								<Button
									color="danger"
									onClick={() => {
										if (confirm(`Smazat člena ${m.name}?`))
											del.mutate({ userId: m.id });
									}}
								>
									Smazat
								</Button>
							</td>
						</tr>
					))}
				</tbody>
			</table>
		</div>
	);
}
