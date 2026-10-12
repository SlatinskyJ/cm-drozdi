'use client';
import { isSameDay, startOfDay } from 'date-fns';
import { type Matcher } from 'react-day-picker';
import { Calendar } from '@components/ui/calendar';
import { type TCalendarEvent } from '~/app/_models/event';
import { toWallClockDate } from '~/utils/date';

const noop = () => undefined;

export function CalendarWithDates({
	events,
}: Readonly<{ events: TCalendarEvent[] }>) {
	const eventDates = events
		.map((event) => event.start)
		.filter((date): date is Date => !!date)
		.map(toWallClockDate);

	const isEventDate: Matcher = (day) =>
		eventDates.some((eventDate) => isSameDay(eventDate, day));

	// Display-only: controlled with nothing selected and a no-op `onSelect`, so
	// clicking a day doesn't highlight it as if it did something.
	return (
		<Calendar
			mode="single"
			selected={undefined}
			onSelect={noop}
			disabled={[{ before: startOfDay(new Date()) }, isEventDate]}
			showOutsideDays
		/>
	);
}
