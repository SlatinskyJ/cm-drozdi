"use client";
import { Button } from "@components/ui/Button";
import {
  Modal,
  ModalBody,
  ModalContent,
  ModalFooter,
  ModalHeader,
  useDisclosure,
} from "@nextui-org/modal";
import React, { useCallback } from "react";
import toast from "react-hot-toast";
import { EventForm } from "~/app/events/_components/EventForm";
import { useEventForm } from "~/app/events/_utils/useEventForm";
import { api } from "~/trpc/react";

export default function RequestEvent() {
  const { isOpen, onOpen, onClose } = useDisclosure();
  const utils = api.useUtils();

  const onSaveSuccess = useCallback(() => {
    void utils.event.getForCalendar.invalidate();
    onClose();
    toast.success("Rezervace vytvořena");
  }, [onClose, utils.event.getForCalendar]);

  const {
    handleSubmit,
    control,
    isPending,
    formState: { isValid },
  } = useEventForm(undefined, onSaveSuccess);

  return (
    <>
      <Button
        className="fixed bottom-20 right-16 z-50 text-2xl shadow-lg"
        radius="full"
        color="primary"
        size="xl"
        onClick={onOpen}
      >
        Rezervovat
      </Button>
      <Modal isOpen={isOpen} size="xl" hideCloseButton backdrop="blur">
        <ModalContent>
          <ModalHeader className="flex justify-center">
            Nová rezervace
          </ModalHeader>
          <form onSubmit={handleSubmit}>
            <ModalBody>
              <EventForm control={control} />
            </ModalBody>
            <ModalFooter className="flex">
              <Button
                onClick={onClose}
                isLoading={isPending}
                color="danger"
                variant="ghost"
              >
                Zrušit
              </Button>
              <div className="grow" />
              <Button
                type="submit"
                isLoading={isPending}
                isDisabled={!isValid}
                color="primary"
              >
                Potvrdit
              </Button>
            </ModalFooter>
          </form>
        </ModalContent>
      </Modal>
    </>
  );
}
