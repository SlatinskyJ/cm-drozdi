import { Skeleton } from '@components/ui/Skeleton';

export function ResetPasswordSkeleton() {
	return (
		<div className="flex h-full w-full items-center justify-center">
			<div className="flex w-80 flex-col gap-4">
				<Skeleton className="h-7 w-40 rounded-full" />
				<Skeleton className="h-10 w-full rounded" />
				<Skeleton className="h-10 w-full rounded" />
				<Skeleton className="h-10 w-full rounded" />
			</div>
		</div>
	);
}
