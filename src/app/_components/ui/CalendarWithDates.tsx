'use client';
import { isSameDay } from 'date-fns';
import { useState } from 'react';
import { type Matcher } from 'react-day-picker';
import { Calendar } from '@components/ui/calendar';
import { type TCalendarEvent } from '~/app/_models/event';
import { APP_TIME_ZONE, appTz, startOfTodayInAppTz } from '~/utils/date';

const noop = () => undefined;

export function CalendarWithDates({
	events,
}: Readonly<{ events: TCalendarEvent[] }>) {
	// The displayed month is controlled: react-day-picker's uncontrolled month
	// state is reset to the initial month by a mount effect (keyed on
	// `timeZone`). After hydration that effect can run *after* an early
	// month-navigation click, silently jumping the calendar back to today's
	// month. With `month` controlled, that reset is a no-op.
	const [month, setMonth] = useState<Date>(startOfTodayInAppTz);

	const eventDates = events
		.map((event) => event.start)
		.filter((date): date is Date => !!date);

	// `day` is midnight of a calendar day in APP_TIME_ZONE (the Calendar's
	// `timeZone`), so compare calendar days in that zone too.
	const isEventDate: Matcher = (day) =>
		eventDates.some((eventDate) => isSameDay(eventDate, day, { in: appTz }));

	// Display-only: controlled with nothing selected and a no-op `onSelect`, so
	// clicking a day doesn't highlight it as if it did something.
	return (
		<Calendar
			mode="single"
			timeZone={APP_TIME_ZONE}
			month={month}
			onMonthChange={setMonth}
			selected={undefined}
			onSelect={noop}
			disabled={[{ before: startOfTodayInAppTz() }, isEventDate]}
			showOutsideDays
		/>
	);
}
