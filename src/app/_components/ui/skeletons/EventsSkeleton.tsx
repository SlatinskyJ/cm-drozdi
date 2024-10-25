import { EventSkeleton } from "@components/ui/skeletons/EventSkeleton";

export async function EventsSkeleton() {
  return (
    <>
      <EventSkeleton />
      <EventSkeleton />
      <EventSkeleton />
    </>
  );
}
