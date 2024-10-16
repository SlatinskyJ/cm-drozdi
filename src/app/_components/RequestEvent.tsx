"use client";
import { getLocalTimeZone, today } from "@internationalized/date";
import { Button } from "@nextui-org/button";
import { type DateInputValue } from "@nextui-org/date-input";
import { DateRangePicker } from "@nextui-org/date-picker";
import { Input, Textarea } from "@nextui-org/input";
import {
  Modal,
  ModalBody,
  ModalContent,
  ModalFooter,
  ModalHeader,
  useDisclosure,
} from "@nextui-org/modal";
import { Switch } from "@nextui-org/switch";
import { type RangeValue } from "@react-types/shared";
import React, { useCallback } from "react";
import { Controller, type SubmitHandler, useForm } from "react-hook-form";
import toast from "react-hot-toast";
import { type TCreateEvent } from "~/app/_models/event";
import { api } from "~/trpc/react";

type Inputs = Omit<TCreateEvent, "start" | "end"> & {
  date: RangeValue<DateInputValue>;
};

export default function RequestEvent() {
  const { isOpen, onOpen, onClose } = useDisclosure();
  const { mutate: createEvent, isPending } = api.event.create.useMutation();

  const {
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<Inputs>({ defaultValues: { isPrivate: true } });

  const onSubmit: SubmitHandler<Inputs> = useCallback(
    (data) => {
      const {
        date: { start, end },
        ...rest
      } = data;

      const req: TCreateEvent = {
        ...rest,
        start: start.toDate(getLocalTimeZone()),
        end: end.toDate(getLocalTimeZone()),
      };
      createEvent(req, {
        onSuccess: () => {
          toast.success("Rezervace vytvořena");
          onClose();
        },
      });
    },
    [createEvent, onClose],
  );

  return (
    <>
      <Button
        className="fixed bottom-20 right-16 z-50 p-8 text-xl font-semibold shadow-lg"
        radius="full"
        color="primary"
        onClick={onOpen}
      >
        Rezervovat
      </Button>
      <Modal isOpen={isOpen} size="2xl">
        <ModalContent>
          <ModalHeader className="flex justify-center">
            Nová rezervace
          </ModalHeader>
          <form onSubmit={handleSubmit(onSubmit)}>
            <ModalBody>
              <Controller
                name="name"
                control={control}
                render={({ field }) => (
                  <Input {...field} label="Název události" isRequired />
                )}
              />
              <Controller
                name="isPrivate"
                control={control}
                render={(field) => (
                  <Switch
                    isSelected={field.field.value}
                    onValueChange={field.field.onChange}
                  >
                    Soukormá událost
                  </Switch>
                )}
              />
              <Controller
                name="date"
                control={control}
                render={({ field }) => (
                  <DateRangePicker
                    {...field}
                    minValue={today(getLocalTimeZone())}
                    granularity="minute"
                    label="Datum a čas"
                  />
                )}
              />
              <Controller
                name="email"
                control={control}
                render={({ field }) => (
                  <Input {...field} label="Email" isRequired />
                )}
              />
              <Controller
                name="phone"
                control={control}
                render={({ field }) => <Input {...field} label="Telefon" />}
              />
              <Controller
                name="location"
                control={control}
                render={({ field }) => <Input {...field} label="Lokace" />}
              />
              <Controller
                name="description"
                control={control}
                render={({ field }) => <Textarea {...field} label="Popis" />}
              />
            </ModalBody>
            <ModalFooter>
              <Button onClick={onClose} isLoading={isPending}>
                Zrušit
              </Button>
              <Button type="submit" isLoading={isPending}>
                Potvrdit
              </Button>
            </ModalFooter>
          </form>
        </ModalContent>
      </Modal>
    </>
  );
}
