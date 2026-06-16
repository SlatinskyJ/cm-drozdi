'use client';
import { Button } from '@components/ui/Button';
import { LoginFormFields } from '~/app/login/LoginFormFields';
import { useLoginForm } from '~/app/login/_utils/useLoginForm';

export default function LoginForm() {
	const { handleSubmit, control, isSubmitting, errors } = useLoginForm();

	return (
		<div className="flex h-full w-full items-center justify-center">
			<form onSubmit={handleSubmit} className="flex w-80 flex-col gap-4">
				<h1 className="text-xl font-bold">Přihlásit</h1>
				<LoginFormFields control={control} />
				{errors.root && (
					<p className="text-sm text-red-500">{errors.root.message}</p>
				)}
				<Button type="submit" color="primary" disabled={isSubmitting}>
					Přihlásit
				</Button>
			</form>
		</div>
	);
}
