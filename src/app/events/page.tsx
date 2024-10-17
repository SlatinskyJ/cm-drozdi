import { api } from "~/trpc/server";
import Event from "./_components/Event";

export default async function EventsPage() {
  const events = await api.event.getUpcoming();

  return (
    <div className="flex h-full w-full flex-col bg-background">
      <div className="h-[70px] w-full bg-green-300 pt-5">
        <span className="ml-8 text-2xl font-semibold">Události</span>
      </div>
      <div className="h-12 w-full pt-5">
        <span className="ml-8 text-xl font-semibold">Nadcházející</span>
      </div>
      <div className="m-4 flex gap-4">
        {events.map((event) => (
          <Event key={event.id} event={event} />
        ))}
      </div>
    </div>
  );
}
