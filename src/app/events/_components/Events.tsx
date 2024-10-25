import { EventsSkeleton } from "@components/ui/skeletons/EventsSkeleton";
import { Suspense } from "react";
import Event from "~/app/events/_components/Event";
import { api } from "~/trpc/server";

export default async function Events() {
  return (
    <Suspense fallback={<EventsSkeleton />}>
      <EventsWrapper />
    </Suspense>
  );
}

async function EventsWrapper() {
  const events = await api.event.getUpcoming();

  return (
    <>
      {events.map((event) => (
        <Event key={event.id} event={event} />
      ))}
    </>
  );
}
