'use client';

import { Button } from '@components/ui/Button';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useState } from 'react';
import { api } from '~/trpc/react';

function ResetPasswordForm() {
	const router = useRouter();
	const token = useSearchParams().get('token') ?? '';
	const [password, setPassword] = useState('');
	const [error, setError] = useState<string | null>(null);
	const setPasswordMut = api.member.setPassword.useMutation({
		onSuccess: () => router.push('/login'),
		onError: (e) => setError(e.message),
	});

	function onSubmit(e: React.FormEvent) {
		e.preventDefault();
		setError(null);
		if (password.length < 8) {
			setError('Heslo musí mít alespoň 8 znaků.');
			return;
		}
		setPasswordMut.mutate({ token, newPassword: password });
	}

	if (!token) return <p className="p-8">Neplatný odkaz.</p>;

	return (
		<div className="flex h-full w-full items-center justify-center">
			<form onSubmit={onSubmit} className="flex w-80 flex-col gap-4">
				<h1 className="text-xl font-bold">Nastavit heslo</h1>
				<input
					type="password"
					placeholder="Nové heslo (min. 8 znaků)"
					value={password}
					onChange={(e) => setPassword(e.target.value)}
					required
					className="rounded border px-3 py-2"
				/>
				{error && <p className="text-sm text-red-500">{error}</p>}
				<Button
					type="submit"
					color="primary"
					disabled={setPasswordMut.isPending}
				>
					Nastavit heslo
				</Button>
			</form>
		</div>
	);
}

export default function ResetPasswordPage() {
	return (
		<Suspense fallback={null}>
			<ResetPasswordForm />
		</Suspense>
	);
}
