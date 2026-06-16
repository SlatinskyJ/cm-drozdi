'use client';
import { type Control, Controller } from 'react-hook-form';
import { UserRole } from '~/enums/UserRole';
import { type TCreateMemberInputs } from '~/app/members/_utils/useCreateMemberForm';

const ASSIGNABLE: { label: string; value: UserRole }[] = [
	{ label: 'Člen', value: UserRole.MEMBER },
	{ label: 'Admin', value: UserRole.ADMIN },
];

export function CreateMemberFields({
	control,
}: Readonly<{ control: Control<TCreateMemberInputs> }>) {
	return (
		<>
			<Controller
				name="name"
				control={control}
				rules={{ required: true }}
				render={({ field }) => (
					<input
						{...field}
						type="text"
						placeholder="Jméno"
						required
						className="rounded border px-3 py-2"
					/>
				)}
			/>
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
				name="role"
				control={control}
				render={({ field }) => (
					<select {...field} className="rounded border px-3 py-2">
						{ASSIGNABLE.map((r) => (
							<option key={r.value} value={r.value}>
								{r.label}
							</option>
						))}
					</select>
				)}
			/>
		</>
	);
}
