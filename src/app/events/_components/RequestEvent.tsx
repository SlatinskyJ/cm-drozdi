'use client';
import { Button } from '@components/ui/button';
import {
	Dialog,
	DialogContent,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from '@components/ui/dialog';
import { useRouter } from 'next/navigation';
import React, { useCallback, useState } from 'react';
import toast from 'react-hot-toast';
import { EventForm } from '~/app/events/_components/EventForm';
import { useEventForm } from '~/app/events/_utils/useEventForm';

export default function RequestEvent() {
	const [isOpen, setIsOpen] = useState(false);
	const router = useRouter();

	const onSaveSuccess = useCallback(() => {
		router.refresh();
		setIsOpen(false);
		toast.success('Rezervace vytvořena');
	}, [router]);

	const {
		handleSubmit,
		control,
		isPending,
		formState: { isValid },
	} = useEventForm(undefined, onSaveSuccess);

	return (
		<>
			<Button
				className="fixed bottom-12 right-3 z-50 rounded-full text-2xl shadow-lg lg:bottom-14 lg:right-5"
				variant="primary"
				size="xl"
				onClick={() => setIsOpen(true)}
			>
				Rezervovat
			</Button>
			<Dialog open={isOpen} onOpenChange={setIsOpen}>
				<DialogContent className="sm:max-w-3xl" showCloseButton={false}>
					<DialogHeader>
						<DialogTitle className="text-center">
							Nová rezervace
						</DialogTitle>
					</DialogHeader>
					<form onSubmit={handleSubmit}>
						<EventForm control={control} />
						<DialogFooter className="mt-4 flex-row">
							<Button
								type="button"
								onClick={() => setIsOpen(false)}
								isLoading={isPending}
								variant="destructive-ghost"
							>
								Zrušit
							</Button>
							<div className="grow" />
							<Button
								type="submit"
								isLoading={isPending}
								isDisabled={!isValid}
								variant="primary"
							>
								Potvrdit
							</Button>
						</DialogFooter>
					</form>
				</DialogContent>
			</Dialog>
		</>
	);
}
