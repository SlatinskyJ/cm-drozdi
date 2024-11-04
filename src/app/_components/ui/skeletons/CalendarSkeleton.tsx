import { Skeleton } from '@components/ui/Skeleton';

export default function CalendarSkeleton() {
	return (
		<div className="w-[256px] rounded-large bg-content1 shadow-small">
			<Skeleton className="mx-16 my-2 h-[32px] rounded-full" />
			<div className="mb-2 flex h-[22px] w-full justify-center text-small font-medium text-default-400">
				<span className="w-8 text-center">P</span>
				<span className="w-8 text-center">Ú</span>
				<span className="w-8 text-center">S</span>
				<span className="w-8 text-center">Č</span>
				<span className="w-8 text-center">P</span>
				<span className="w-8 text-center">S</span>
				<span className="w-8 text-center">N</span>
			</div>
			<Skeleton className="h-[188px]" />
		</div>
	);
}
