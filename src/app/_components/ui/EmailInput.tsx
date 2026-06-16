'use client';
import {
	Controller,
	type Control,
	type FieldValues,
	type Path,
} from 'react-hook-form';

const EMAIL_PATTERN = {
	value: /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i,
	message: 'Neplatná e-mailová adresa',
};

export function EmailInput<T extends FieldValues>({
	control,
	name,
}: Readonly<{ control: Control<T>; name: Path<T> }>) {
	return (
		<Controller
			name={name}
			control={control}
			rules={{ required: true, pattern: EMAIL_PATTERN }}
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
	);
}
