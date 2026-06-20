import { Skeleton } from '@components/ui/skeleton';
import { Card, CardContent, CardHeader } from '@components/ui/card';
import { Separator } from '@components/ui/separator';

export async function EventSkeleton() {
	return (
		<Card className="w-[265px] bg-green-400 [&:nth-child(2)]:opacity-75 [&:nth-child(3)]:opacity-50">
			<CardHeader className="flex flex-row items-center">
				<Skeleton className="h-7 w-36 rounded-full" />
				<div className="grow" />
				<Skeleton className="h-7 w-10 rounded-full" />
			</CardHeader>
			<Separator />
			<CardContent>
				<Skeleton className="h-[7.5rem] w-full rounded-xl" />
			</CardContent>
		</Card>
	);
}
