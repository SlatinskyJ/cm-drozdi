"use client";
import { Chip } from "@components/ui/Chip";
import {
  Dropdown,
  DropdownItem,
  DropdownMenu,
  DropdownTrigger,
} from "@components/ui/Dropdown";
import { toNumber } from "lodash";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import { BiSolidDownArrow } from "react-icons/bi";
import { type TEvent } from "~/app/_models/event";
import { type TFormatEventStateReturn } from "~/app/events/_utils/formatEventState";
import { EventState } from "~/enums/EventState";
import { api } from "~/trpc/react";

export default function EditableState({
  state,
  eventId,
}: Readonly<{ state: TFormatEventStateReturn; eventId: TEvent["id"] }>) {
  const { mutate } = api.event.changeState.useMutation();
  const utils = api.useUtils();
  const router = useRouter();

  const handleUpdate = (newState: string | number) => {
    mutate(
      { id: eventId, state: toNumber(newState) as EventState },
      {
        onSuccess: () => {
          void utils.event.getUpcoming.refetch();
          toast.success("Stav změněn");
          router.refresh();
        },
      },
    );
  };

  const options = [
    <DropdownItem key={EventState.PENDING} color="warning">
      Nerozhodnuto
    </DropdownItem>,
    <DropdownItem key={EventState.CONFIRMED} color="success">
      Potvrzeno
    </DropdownItem>,
    <DropdownItem key={EventState.CANCELED} color="danger">
      Zrušeno
    </DropdownItem>,
  ].filter((com) => (com.key as unknown) != state.value);

  return (
    <Dropdown>
      <DropdownTrigger>
        <Chip
          color={state.color}
          endContent={<BiSolidDownArrow className="mr-2" />}
        >
          {state.label}
        </Chip>
      </DropdownTrigger>
      <DropdownMenu onAction={handleUpdate}>{...options}</DropdownMenu>
    </Dropdown>
  );
}
