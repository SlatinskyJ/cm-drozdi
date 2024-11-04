import Events from '~/app/events/_components/Events';

export default async function EventsPage() {
	return (
		<div className="flex h-full w-full flex-wrap justify-center bg-background">
			<div className="h-[70px] w-full bg-green-300 pt-5">
				<span className="ml-8 text-2xl font-semibold">Události</span>
			</div>
			<div className="w-full max-w-[1500px]">
				<div className="h-12 w-full pt-5">
					<span className="ml-8 text-xl font-semibold">
						Nadcházející
					</span>
				</div>
				<div className="m-4 flex flex-wrap gap-4">
					<Events />
				</div>
			</div>
		</div>
	);
}
