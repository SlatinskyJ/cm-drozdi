import {
	type CalendarDateTime,
	parseDateTime,
} from '@internationalized/date';
import { differenceInMinutes, format } from 'date-fns';

export function formatDuration(start: Date, end: Date): string {
	const minutes = differenceInMinutes(end, start);
	const hours = Math.floor(minutes / 60);
	const remainder = String(minutes % 60).padStart(2, '0');
	return `${hours}:${remainder}`;
}

export function parseDateJStoCalendarDateTime(date: Date): CalendarDateTime {
	return parseDateTime(date.toISOString().slice(0, -1));
}

export function formatDateToTime(date: Date): string {
	return format(date, 'H:mm');
}
