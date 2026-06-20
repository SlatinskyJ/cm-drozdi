import { addMinutes, differenceInMinutes } from 'date-fns';
import { isNil, omitBy } from 'lodash';
import { useCallback } from 'react';
import { type SubmitHandler, useForm } from 'react-hook-form';
import { type TCreateEvent, type TEvent } from '~/app/_models/event';
import { api } from '~/trpc/react';

export type TEventInputs = Omit<TCreateEvent, 'start' | 'end'> & {
	start: Date;
	duration: string;
};

export const DURATION_PATTERN = /^([0-9]{1,2}):([0-5][0-9])$/;

function formatDurationMinutes(minutes: number): string {
	const hours = Math.floor(minutes / 60);
	const remainder = String(minutes % 60).padStart(2, '0');
	return `${hours}:${remainder}`;
}

function parseDurationMinutes(duration: string): number {
	const match = DURATION_PATTERN.exec(duration);
	if (!match) return 0;
	return Number(match[1]) * 60 + Number(match[2]);
}

function transformInitValues(data?: TEvent): Partial<TEventInputs> {
	if (!data) return {};

	const { start, end, ...rest } = data;
	const duration =
		!!start && !!end
			? formatDurationMinutes(differenceInMinutes(end, start))
			: undefined;
	return { ...omitBy(rest, isNil), start: start ?? undefined, duration };
}

export function useEventForm(initValues?: TEvent, onSuccess?: () => void) {
	const { mutate: createEvent, isPending } = api.event.create.useMutation();

	const transformedInitValues = transformInitValues(initValues);

	const { handleSubmit, ...restForm } = useForm<TEventInputs>({
		defaultValues: { isPrivate: true, ...transformedInitValues },
		mode: 'onChange',
	});

	const onSubmit: SubmitHandler<TEventInputs> = useCallback(
		(data) => {
			const { start, duration, ...rest } = data;

			const req: TCreateEvent = {
				...rest,
				start,
				end: addMinutes(start, parseDurationMinutes(duration)),
			};
			createEvent(req, {
				onSuccess,
			});
		},
		[createEvent, onSuccess],
	);

	return { ...restForm, handleSubmit: handleSubmit(onSubmit), isPending };
}
