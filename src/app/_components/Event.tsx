import { Card, CardBody, CardHeader } from "@nextui-org/card";
import { Chip } from "@nextui-org/chip";
import { Divider } from "@nextui-org/divider";
import { Tooltip } from "@nextui-org/tooltip";
import { type ReactElement } from "react";
import KeyValue from "~/app/_components/KeyValue";
import { type TEvent } from "~/app/_models/event";
import { EventState } from "~/enums/EventState";
import { formatDateToTime, formatTime, getTimeDiff } from "~/utils/date";

function formatEventState(state: EventState): ReactElement {
  switch (state) {
    case EventState.PROPOSED:
      return <Chip color="default">Návrh</Chip>;
    case EventState.PENDING:
      return <Chip color="warning">Nerozhodnuto</Chip>;
    case EventState.CONFIRMED:
      return <Chip color="success">Potvrzeno</Chip>;
    case EventState.CANCELED:
      return <Chip color="danger">Zrušeno</Chip>;
    default:
      return <Chip>Neznámý</Chip>;
  }
}

export default function Event({ event }: Readonly<{ event: TEvent }>) {
  const timeDiff =
    (!!event.start && !!event.end && getTimeDiff(event.start, event.end)) ??
    null;

  return (
    <Card className="w-1/5 bg-accent">
      <CardHeader className="flex">
        <Tooltip content={event.name} delay={500}>
          <span className="truncate text-lg">{event.name}</span>
        </Tooltip>
        <div className="grow" />
        {formatEventState(event.state)}
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
  );
}
