'use client';
import { useCallback } from 'react';
import { type SubmitHandler, useForm } from 'react-hook-form';
import toast from 'react-hot-toast';
import { UserRole } from '~/enums/UserRole';
import { api } from '~/trpc/react';

export type TCreateMemberInputs = {
	name: string;
	email: string;
	role: UserRole;
};

export function useCreateMemberForm() {
	const utils = api.useUtils();
	const genLink = api.member.generatePasswordLink.useMutation({
		onError: (e) => toast.error(e.message),
	});
	const { mutate: create, isPending: createPending } = api.member.create.useMutation({
		onError: (e) => toast.error(e.message),
	});

	const { handleSubmit, control, reset } = useForm<TCreateMemberInputs>({
		defaultValues: { role: UserRole.MEMBER },
		mode: 'onChange',
	});

	const onSubmit: SubmitHandler<TCreateMemberInputs> = useCallback(
		(data) => {
			create(data, {
				onSuccess: async ({ userId }) => {
					reset();
					await utils.member.list.invalidate();
					toast.success('Člen vytvořen.');
					try {
						const { url } = await genLink.mutateAsync({ userId });
						await navigator.clipboard.writeText(url);
						toast.success('Odkaz pro nastavení hesla zkopírován.');
					} catch {
						// genLink.onError already shows the error toast
					}
				},
			});
		},
		[create, genLink, reset, utils],
	);

	return {
		handleSubmit: handleSubmit(onSubmit),
		control,
		isPending: createPending || genLink.isPending,
	};
}
