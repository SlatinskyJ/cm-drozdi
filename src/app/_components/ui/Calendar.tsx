"use client";
import {
  type DateValue,
  getLocalTimeZone,
  isSameDay,
  today,
} from "@internationalized/date";
import { Calendar as NextCalendar } from "@nextui-org/calendar";
import { extendVariants } from "@nextui-org/system";
import { type TCalendarEvent } from "~/app/_models/event";
import { parseDateJStoCalendarDateTime } from "~/utils/date";

export const Calendar = extendVariants(NextCalendar, {});

export function CalendarWithDates({
  events,
}: Readonly<{ events: TCalendarEvent[] }>) {
  const dates = events.map((event) =>
    parseDateJStoCalendarDateTime(event.start!),
  );

  const isDateUnavailable = (calendarDate: DateValue): boolean => {
    return !!dates?.find((date) => isSameDay(date, calendarDate));
  };

  return (
    <Calendar
      isReadOnly
      isDateUnavailable={isDateUnavailable}
      showShadow
      minValue={today(getLocalTimeZone())}
    />
  );
}
