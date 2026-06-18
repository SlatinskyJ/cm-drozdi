import { Skeleton } from '@components/ui/Skeleton';

export function MembersSkeleton() {
	return (
		<div className="w-full space-y-2">
			{Array.from({ length: 3 }).map((_, i) => (
				<div key={i} className="flex gap-4 border-t py-2">
					<Skeleton className="h-6 w-32 rounded-full" />
					<Skeleton className="h-6 w-40 rounded-full" />
					<Skeleton className="h-6 w-20 rounded-full" />
					<Skeleton className="h-6 w-28 rounded-full" />
				</div>
			))}
		</div>
	);
}
