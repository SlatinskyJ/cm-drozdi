import { type ChipProps } from "@components/ui/Chip";
import { EventState } from "~/enums/EventState";

export type TFormatEventStateReturn = {
  label: string;
  color: ChipProps["color"];
};

export default function formatEventState(
  state: EventState,
): TFormatEventStateReturn {
  switch (state) {
    case EventState.PROPOSED:
      return { label: "Návrh", color: "default" };
    case EventState.PENDING:
      return { label: "Nerozhodnuto", color: "warning" };
    case EventState.CONFIRMED:
      return { label: "Potvrzeno", color: "success" };
    case EventState.CANCELED:
      return { label: "Zrušeno", color: "danger" };
    default:
      return { label: "Neznámý", color: "unknown" };
  }
}
