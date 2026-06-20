import { Button } from '@components/ui/button';
import {
	Dialog,
	DialogContent,
	DialogFooter,
	DialogHeader,
} from '@components/ui/dialog';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { type TEvent } from '~/app/_models/event';
import DeleteEvent from '~/app/events/_components/DeleteEvent';
import EditableState from '~/app/events/_components/EditableState';
import { EventForm } from '~/app/events/_components/EventForm';
import EventValues from '~/app/events/_components/EventValues';
import { useEventForm } from '~/app/events/_utils/useEventForm';
import { type TFormatEventStateReturn } from '../_utils/formatEventState';

export function EventDetailModal({
	event,
	state,
	isOpen,
	onClose,
}: Readonly<{
	event: TEvent;
	state: TFormatEventStateReturn;
	isOpen: boolean;
	onClose: () => void;
}>) {
	const [isEdit, setIsEdit] = useState<boolean>(false);
	const router = useRouter();

	const handleEdit = () => {
		setIsEdit((prev) => !prev);
	};

	const handleClose = () => {
		onClose();
		setIsEdit(false);
	};

	const handleSaveSuccess = () => {
		router.refresh();
		handleClose();
	};

	const {
		control,
		handleSubmit,
		isPending,
		formState: { isValid },
	} = useEventForm(event, handleSaveSuccess);

	return (
		<Dialog open={isOpen} onOpenChange={(open) => !open && handleClose()}>
			<DialogContent className="sm:max-w-2xl" showCloseButton={false}>
				<DialogHeader className="flex flex-row items-center">
					<div>{event.name}</div>
					<div className="grow" />
					<EditableState state={state} eventId={event.id} />
				</DialogHeader>
				{isEdit ? (
					<EventForm control={control} />
				) : (
					<EventValues event={event} />
				)}
				<DialogFooter className="flex-row">
					<Button onClick={handleClose} variant="destructive-ghost">
						Zavřít
					</Button>
					<div className="grow" />
					<DeleteEvent eventId={event.id} onSuccess={handleClose} />
					{isEdit ? (
						<Button
							variant="primary"
							onClick={handleSubmit}
							isLoading={isPending}
							isDisabled={!isValid}
						>
							Uložit
						</Button>
					) : (
						<Button variant="primary" onClick={handleEdit}>
							Editovat
						</Button>
					)}
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
