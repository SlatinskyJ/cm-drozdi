import {
  type CalendarDateTime,
  parseDateTime,
  parseTime,
  Time,
} from "@internationalized/date";
import { floor, trimStart } from "lodash";

export function getTimeDiff(start: Date, end: Date): Time {
  const startDateTime = parseDateJStoCalendarDateTime(start);
  const endDateTime = parseDateJStoCalendarDateTime(end);
  const minutes = endDateTime.compare(startDateTime) / (60 * 1000);
  return new Time(floor(minutes / 60), minutes % 60);
}

export function parseDateJStoCalendarDateTime(date: Date): CalendarDateTime {
  return parseDateTime(date.toISOString().slice(0, -1));
}

export function formatTime(time: Time): string {
  return trimStart(time.toString().slice(0, -3), "0");
}

export function formatDateToTime(date: Date): string {
  return formatTime(parseTime(date.toISOString().slice(11, 16)));
}
