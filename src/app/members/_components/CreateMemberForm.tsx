'use client';
import { Button } from '@components/ui/button';
import { CreateMemberFields } from '~/app/members/_components/CreateMemberFields';
import { useCreateMemberForm } from '~/app/members/_utils/useCreateMemberForm';

export function CreateMemberForm() {
	const { handleSubmit, control, isPending } = useCreateMemberForm();

	return (
		<form
			onSubmit={handleSubmit}
			className="mb-8 flex flex-wrap items-end gap-2"
		>
			<CreateMemberFields control={control} />
			<Button type="submit" variant="primary" disabled={isPending}>
				Vytvořit
			</Button>
		</form>
	);
}
