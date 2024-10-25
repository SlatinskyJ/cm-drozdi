import { Skeleton } from "@components/ui/Skeleton";
import { Card, CardBody, CardHeader } from "@nextui-org/card";
import { Divider } from "@nextui-org/divider";

export async function EventSkeleton() {
  return (
    <Card className="w-[265px] bg-green-400 [&:nth-child(2)]:opacity-75 [&:nth-child(3)]:opacity-50">
      <CardHeader className="flex">
        <Skeleton className="h-7 w-36 rounded-full" />
        <div className="grow" />
        <Skeleton className="h-7 w-10 rounded-full" />
      </CardHeader>
      <Divider />
      <CardBody>
        <Skeleton className="h-[7.5rem] w-full rounded-xl" />
      </CardBody>
    </Card>
  );
}
