import { getLocalTimeZone } from "@internationalized/date";
import type { DateInputValue } from "@nextui-org/date-input";
import type { RangeValue } from "@react-types/shared";
import { isNil, omitBy } from "lodash";
import { useCallback } from "react";
import { type SubmitHandler, useForm } from "react-hook-form";
import { type TCreateEvent, type TEvent } from "~/app/_models/event";
import { api } from "~/trpc/react";
import { parseDateJStoCalendarDateTime } from "~/utils/date";

export type TEventInputs = Omit<TCreateEvent, "start" | "end"> & {
  date: RangeValue<DateInputValue>;
};

function transformInitValues(data?: TEvent): Partial<TEventInputs> {
  if (!data) return {};

  const { start, end, ...rest } = data;
  const date =
    !!start && !!end
      ? {
          start: parseDateJStoCalendarDateTime(start),
          end: parseDateJStoCalendarDateTime(end),
        }
      : undefined;
  return { ...omitBy(rest, isNil), date };
}

export function useEventForm(initValues?: TEvent, onSuccess?: () => void) {
  const { mutate: createEvent, isPending } = api.event.create.useMutation();

  const transformedInitValues = transformInitValues(initValues);

  const { handleSubmit, ...restForm } = useForm<TEventInputs>({
    defaultValues: { isPrivate: true, ...transformedInitValues },
    mode: "onChange",
  });

  const onSubmit: SubmitHandler<TEventInputs> = useCallback(
    (data) => {
      const { date, ...rest } = data;

      const req: TCreateEvent = {
        ...rest,
        start: date?.start.toDate(getLocalTimeZone()),
        end: date?.end.toDate(getLocalTimeZone()),
      };
      createEvent(req, {
        onSuccess,
      });
    },
    [createEvent, onSuccess],
  );

  return { ...restForm, handleSubmit: handleSubmit(onSubmit), isPending };
}
