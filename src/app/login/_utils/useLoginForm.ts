'use client';
import { useRouter } from 'next/navigation';
import { useCallback } from 'react';
import { type SubmitHandler, useForm } from 'react-hook-form';
import { signIn } from '~/lib/auth-client';

export type TLoginInputs = {
	email: string;
	password: string;
};

export function useLoginForm() {
	const router = useRouter();
	const { handleSubmit, control, setError, formState } = useForm<TLoginInputs>({
		mode: 'onChange',
	});

	const onSubmit: SubmitHandler<TLoginInputs> = useCallback(
		async (data) => {
			const { error } = await signIn.email({
				email: data.email,
				password: data.password,
			});
			if (error) {
				setError('root', {
					message: 'Přihlášení selhalo. Zkontrolujte e-mail a heslo.',
				});
				return;
			}
			router.push('/events');
			router.refresh();
		},
		[router, setError],
	);

	return {
		handleSubmit: handleSubmit(onSubmit),
		control,
		isSubmitting: formState.isSubmitting,
		errors: formState.errors,
	};
}
