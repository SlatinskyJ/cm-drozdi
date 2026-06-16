'use client';
import { Button } from '@components/ui/Button';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense } from 'react';
import { ResetPasswordFormFields } from '~/app/reset-password/ResetPasswordFormFields';
import { useResetPasswordForm } from '~/app/reset-password/_utils/useResetPasswordForm';

function ResetPasswordForm() {
	const router = useRouter();
	const token = useSearchParams().get('token') ?? '';

	const { handleSubmit, control, isPending, errors } = useResetPasswordForm(
		token,
		() => router.push('/login'),
	);

	if (!token) return <p className="p-8">Neplatný odkaz.</p>;

	return (
		<div className="flex h-full w-full items-center justify-center">
			<form onSubmit={handleSubmit} className="flex w-80 flex-col gap-4">
				<h1 className="text-xl font-bold">Nastavit heslo</h1>
				<ResetPasswordFormFields control={control} />
				{(errors.password?.message ?? errors.root?.message) && (
					<p className="text-sm text-red-500">
						{errors.password?.message ?? errors.root?.message}
					</p>
				)}
				<Button type="submit" color="primary" disabled={isPending}>
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
