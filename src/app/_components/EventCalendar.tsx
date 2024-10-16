"use client";

import "../EventCalendar.css";

import { isSameDay } from "@internationalized/date";
import { Calendar, type DateValue } from "@nextui-org/calendar";
import { api } from "~/trpc/react";
import { parseDateJStoCalendarDateTime } from "~/utils/date";

export default function EventCalendar() {
  const { data: events } = api.event.getForCalendar.useQuery();

  const dates = events?.map((event) =>
    parseDateJStoCalendarDateTime(event.start!),
  );

  const isDateUnavailable = (calendarDate: DateValue): boolean => {
    return !!dates?.find((date) => isSameDay(date, calendarDate));
  };

  return (
    <>
      <div className="flex justify-center pb-3">
        <div className="rounded-full bg-secondary px-4 text-xl font-semibold">
          Kalendář akcí
        </div>
      </div>
      <Calendar isReadOnly isDateUnavailable={isDateUnavailable} showShadow />
    </>
  );
}
