'use client';

import { Button } from '@components/ui/Button';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { signIn } from '~/lib/auth-client';

export default function LoginForm() {
	const router = useRouter();
	const [email, setEmail] = useState('');
	const [password, setPassword] = useState('');
	const [error, setError] = useState<string | null>(null);
	const [loading, setLoading] = useState(false);

	async function onSubmit(e: React.FormEvent) {
		e.preventDefault();
		setError(null);
		setLoading(true);
		const { error } = await signIn.email({ email, password });
		setLoading(false);
		if (error) {
			setError('Přihlášení selhalo. Zkontrolujte e-mail a heslo.');
			return;
		}
		router.push('/events');
		router.refresh();
	}

	return (
		<div className="flex h-full w-full items-center justify-center">
			<form onSubmit={onSubmit} className="flex w-80 flex-col gap-4">
				<h1 className="text-xl font-bold">Přihlásit</h1>
				<input
					type="email"
					placeholder="E-mail"
					value={email}
					onChange={(e) => setEmail(e.target.value)}
					required
					className="rounded border px-3 py-2"
				/>
				<input
					type="password"
					placeholder="Heslo"
					value={password}
					onChange={(e) => setPassword(e.target.value)}
					required
					className="rounded border px-3 py-2"
				/>
				{error && <p className="text-sm text-red-500">{error}</p>}
				<Button type="submit" color="primary" disabled={loading}>
					Přihlásit
				</Button>
			</form>
		</div>
	);
}
