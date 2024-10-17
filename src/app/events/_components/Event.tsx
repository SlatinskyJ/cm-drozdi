"use client";
import KeyValue from "@components/KeyValue";
import { Chip } from "@components/ui/Chip";
import { Card, CardBody, CardHeader } from "@nextui-org/card";
import { Divider } from "@nextui-org/divider";
import { useDisclosure } from "@nextui-org/modal";
import { Tooltip } from "@nextui-org/tooltip";
import { type TEvent } from "~/app/_models/event";
import formatEventState from "~/app/events/_utils/formatEventState";
import { formatDateToTime, formatTime, getTimeDiff } from "~/utils/date";
import { EventDetailModal } from "./EventDetailModal";

export default function Event({ event }: Readonly<{ event: TEvent }>) {
  const { isOpen, onOpen, onClose } = useDisclosure();

  const timeDiff =
    (!!event.start && !!event.end && getTimeDiff(event.start, event.end)) ??
    null;

  const stateData = formatEventState(event.state);

  return (
    <>
      <Card className="hover: w-1/5 bg-green-400" isPressable onPress={onOpen}>
        <CardHeader className="flex">
          <Tooltip content={event.name} delay={500}>
            <span className="truncate text-lg">{event.name}</span>
          </Tooltip>
          <div className="grow" />
          <Chip color={stateData.color}>{stateData.label}</Chip>
        </CardHeader>
        <Divider />
        <CardBody>
          <KeyValue label="Soukromá" value={event.isPrivate ? "Ano" : "Ne"} />
          <KeyValue
            label="Datum"
            value={event.start?.toLocaleDateString("cs-CZ")}
          />
          <KeyValue
            label="Čas"
            value={!!event.start ? formatDateToTime(event.start) : null}
          />
          <KeyValue
            label="Délka"
            value={!!timeDiff ? formatTime(timeDiff) : null}
          />
          <KeyValue label="Lokace" value={event.location} />
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
