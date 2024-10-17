"use client";

import { Button } from "@components/ui/Button";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import { api } from "~/trpc/react";
import { useIsAdmin } from "~/utils/permissions";

export default function DeleteEvent({
  eventId,
  onSuccess,
}: Readonly<{ eventId: string; onSuccess?: () => void }>) {
  const isAdmin = useIsAdmin();

  const router = useRouter();
  const { mutate, isPending } = api.event.deleteById.useMutation();

  const handleDelete = () => {
    mutate(
      { id: eventId },
      {
        onSuccess: () => {
          if (!!onSuccess) onSuccess();
          router.refresh();
          toast.success("Událost smazána");
        },
      },
    );
  };

  if (!isAdmin) return <></>;

  return (
    <Button onClick={handleDelete} isLoading={isPending} color="danger">
      Smazat
    </Button>
  );
}
