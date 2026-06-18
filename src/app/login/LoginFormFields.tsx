'use client';
import { type Control, Controller } from 'react-hook-form';
import { EmailInput } from '@components/ui/EmailInput';
import { type TLoginInputs } from '~/app/login/_utils/useLoginForm';

export function LoginFormFields({
	control,
}: Readonly<{ control: Control<TLoginInputs> }>) {
	return (
		<>
			<EmailInput control={control} name="email" />
			<Controller
				name="password"
				control={control}
				rules={{ required: true }}
				render={({ field }) => (
					<input
						{...field}
						type="password"
						placeholder="Heslo"
						required
						className="rounded border px-3 py-2"
					/>
				)}
			/>
		</>
	);
}
