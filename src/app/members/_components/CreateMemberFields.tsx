'use client';
import { type Control, Controller } from 'react-hook-form';
import { EmailInput } from '@components/ui/EmailInput';
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
			<EmailInput control={control} name="email" />
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
