'use client';
import { isSameDay, startOfDay } from 'date-fns';
import { type Matcher } from 'react-day-picker';
import { Calendar } from '@components/ui/calendar';
import { type TCalendarEvent } from '~/app/_models/event';

export function CalendarWithDates({
	events,
}: Readonly<{ events: TCalendarEvent[] }>) {
	const eventDates = events
		.map((event) => event.start)
		.filter((date): date is Date => !!date);

	const isEventDate: Matcher = (day) =>
		eventDates.some((eventDate) => isSameDay(eventDate, day));

	return (
		<Calendar
			mode="single"
			selected={undefined}
			disabled={[{ before: startOfDay(new Date()) }, isEventDate]}
			showOutsideDays
		/>
	);
}
