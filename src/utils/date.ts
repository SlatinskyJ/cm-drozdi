import {
  type CalendarDateTime,
  parseDateTime,
  parseTime,
  Time,
} from "@internationalized/date";
import { floor } from "lodash";
import moment from "moment";

export function getTimeDiff(start: Date, end: Date): Time {
  const startDateTime = moment(start);
  const endDateTime = moment(end);

  const minutes = endDateTime.diff(startDateTime, "minutes");
  return new Time(floor(minutes / 60), minutes % 60);
}

export function parseDateJStoCalendarDateTime(date: Date): CalendarDateTime {
  return parseDateTime(date.toISOString().slice(0, -1));
}

export function formatTime(time: Time): string {
  const timeString = time.toString().slice(0, -3);
  if (timeString.startsWith("0")) {
    return timeString.slice(1, timeString.length);
  }
  return timeString;
}

export function formatDateToTime(date: Date): string {
  return formatTime(parseTime(date.toISOString().slice(11, 16)));
}

export function addMinutes(date: Date, minutes: number) {
  return new Date(date.getTime() + minutes * 60 * 1000);
}
