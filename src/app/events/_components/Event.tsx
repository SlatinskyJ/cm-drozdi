"use client";
import { Chip } from "@components/ui/Chip";
import { Tooltip } from "@components/ui/Tooltip";
import { Card, CardBody, CardHeader } from "@nextui-org/card";
import { Divider } from "@nextui-org/divider";
import { useDisclosure } from "@nextui-org/modal";
import { type TEvent } from "~/app/_models/event";
import EventValues from "~/app/events/_components/EventValues";
import formatEventState from "~/app/events/_utils/formatEventState";
import { EventDetailModal } from "./EventDetailModal";

export default function Event({ event }: Readonly<{ event: TEvent }>) {
  const { isOpen, onOpen, onClose } = useDisclosure();

  const stateData = formatEventState(event.state);

  return (
    <>
      <Card className="w-[265px] bg-green-400" isPressable onPress={onOpen}>
        <CardHeader className="flex">
          <Tooltip content={event.name} delay={500} size="xl">
            <span className="truncate text-xl">{event.name}</span>
          </Tooltip>
          <div className="grow" />
          <Chip color={stateData.color}>{stateData.label}</Chip>
        </CardHeader>
        <Divider />
        <CardBody>
          <EventValues event={event} withHover />
        </CardBody>
      </Card>
      <EventDetailModal
        isOpen={isOpen}
        onClose={onClose}
        event={event}
        state={stateData}
      />
    </>
  );
}
