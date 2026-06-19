'use client';
import { Badge } from '@components/ui/badge';
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from '@components/ui/dropdown-menu';
import { useRouter } from 'next/navigation';
import toast from 'react-hot-toast';
import { BiSolidDownArrow } from 'react-icons/bi';
import { type TEvent } from '~/app/_models/event';
import { type TFormatEventStateReturn } from '~/app/events/_utils/formatEventState';
import { EventState } from '~/enums/EventState';
import { api } from '~/trpc/react';

const STATE_ITEM_CLASSNAMES: Record<
	EventState.PENDING | EventState.CONFIRMED | EventState.CANCELED,
	string
> = {
	[EventState.PENDING]: 'text-warning',
	[EventState.CONFIRMED]: 'text-success',
	[EventState.CANCELED]: 'text-danger',
};

export default function EditableState({
	state,
	eventId,
}: Readonly<{ state: TFormatEventStateReturn; eventId: TEvent['id'] }>) {
	const { mutate } = api.event.changeState.useMutation();
	const utils = api.useUtils();
	const router = useRouter();

	const handleUpdate = (newState: EventState) => {
		mutate(
			{ id: eventId, state: newState },
			{
				onSuccess: () => {
					void utils.event.getUpcoming.refetch();
					toast.success('Stav změněn');
					router.refresh();
				},
			},
		);
	};

	const options: { state: EventState; label: string }[] = [
		{ state: EventState.PENDING, label: 'Nerozhodnuto' },
		{ state: EventState.CONFIRMED, label: 'Potvrzeno' },
		{ state: EventState.CANCELED, label: 'Zrušeno' },
	].filter((option) => option.state !== state.value);

	return (
		<DropdownMenu>
			<DropdownMenuTrigger asChild>
				<Badge variant={state.color} className="cursor-pointer">
					{state.label}
					<BiSolidDownArrow className="ml-2" />
				</Badge>
			</DropdownMenuTrigger>
			<DropdownMenuContent>
				{options.map((option) => (
					<DropdownMenuItem
						key={option.state}
						className={
							STATE_ITEM_CLASSNAMES[
								option.state as EventState.PENDING | EventState.CONFIRMED | EventState.CANCELED
							]
						}
						onSelect={() => handleUpdate(option.state)}
					>
						{option.label}
					</DropdownMenuItem>
				))}
			</DropdownMenuContent>
		</DropdownMenu>
	);
}
