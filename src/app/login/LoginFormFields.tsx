'use client';
import { type Control, Controller } from 'react-hook-form';
import { type TLoginInputs } from '~/app/login/_utils/useLoginForm';

export function LoginFormFields({
	control,
}: Readonly<{ control: Control<TLoginInputs> }>) {
	return (
		<>
			<Controller
				name="email"
				control={control}
				rules={{
					required: true,
					pattern: {
						value: /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i,
						message: 'Neplatná e-mailová adresa',
					},
				}}
				render={({ field }) => (
					<input
						{...field}
						type="email"
						placeholder="E-mail"
						required
						className="rounded border px-3 py-2"
					/>
				)}
			/>
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
