'use client';
import { type Control, Controller } from 'react-hook-form';
import { type TResetPasswordInputs } from '~/app/reset-password/_utils/useResetPasswordForm';

export function ResetPasswordFormFields({
	control,
}: Readonly<{ control: Control<TResetPasswordInputs> }>) {
	return (
		<Controller
			name="password"
			control={control}
			rules={{
				required: true,
				minLength: {
					value: 8,
					message: 'Heslo musí mít alespoň 8 znaků.',
				},
			}}
			render={({ field }) => (
				<input
					{...field}
					type="password"
					placeholder="Nové heslo (min. 8 znaků)"
					required
					className="rounded border px-3 py-2"
				/>
			)}
		/>
	);
}
