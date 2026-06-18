'use client';
import { useCallback } from 'react';
import { type SubmitHandler, useForm } from 'react-hook-form';
import { api } from '~/trpc/react';

export type TResetPasswordInputs = {
	password: string;
};

export function useResetPasswordForm(token: string, onSuccess?: () => void) {
	const { mutate: setPassword, isPending } = api.member.setPassword.useMutation({
		onSuccess,
	});

	const { handleSubmit, control, setError, formState } = useForm<TResetPasswordInputs>({
		mode: 'onChange',
	});

	const onSubmit: SubmitHandler<TResetPasswordInputs> = useCallback(
		(data) => {
			setPassword(
				{ token, newPassword: data.password },
				{ onError: (e) => setError('root', { message: e.message }) },
			);
		},
		[token, setPassword, setError],
	);

	return {
		handleSubmit: handleSubmit(onSubmit),
		control,
		isPending,
		errors: formState.errors,
	};
}
