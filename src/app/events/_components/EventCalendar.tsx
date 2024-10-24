import "../../EventCalendar.css";
import { CalendarWithDates } from "@components/ui/Calendar";
import CalendarSkeleton from "@components/ui/skeletons/CalendarSkeleton";
import { Suspense } from "react";
import { api } from "~/trpc/server";

export default async function EventCalendar() {
  return (
    <>
      <div className="flex justify-center pb-3">
        <div className="rounded-full bg-secondary px-4 text-3xl font-semibold">
          Kalendář akcí
        </div>
      </div>
      <div className="flex w-full justify-center">
        <Suspense fallback={<CalendarSkeleton />}>
          <CalendarWrapper />
        </Suspense>
      </div>
    </>
  );
}

async function CalendarWrapper() {
  const events = await api.event.getForCalendar();

  return <CalendarWithDates events={events} />;
}
