"use client";

import { Calendar } from "@components/ui/Calendar";
import "../../EventCalendar.css";

import {
  type DateValue,
  getLocalTimeZone,
  isSameDay,
  today,
} from "@internationalized/date";
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
        <div className="rounded-full bg-secondary px-4 text-3xl font-semibold">
          Kalendář akcí
        </div>
      </div>
      <div className="flex w-full justify-center">
        <Calendar
          isReadOnly
          isDateUnavailable={isDateUnavailable}
          showShadow
          minValue={today(getLocalTimeZone())}
        />
      </div>
    </>
  );
}
