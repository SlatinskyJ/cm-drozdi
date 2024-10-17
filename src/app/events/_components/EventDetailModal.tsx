import { Button } from "@components/ui/Button";
import {
  Modal,
  ModalBody,
  ModalContent,
  ModalFooter,
  ModalHeader,
} from "@nextui-org/modal";
import { useState } from "react";
import { type TEvent } from "~/app/_models/event";
import EditableState from "~/app/events/_components/EditableState";
import { EventForm } from "~/app/events/_components/EventForm";
import EventValues from "~/app/events/_components/EventValues";
import { useEventForm } from "~/app/events/_utils/useEventForm";
import { api } from "~/trpc/react";
import { type TFormatEventStateReturn } from "../_utils/formatEventState";

export function EventDetailModal({
  event,
  state,
  isOpen,
  onClose,
}: Readonly<{
  event: TEvent;
  state: TFormatEventStateReturn;
  isOpen: boolean;
  onClose: () => void;
}>) {
  const [isEdit, setIsEdit] = useState<boolean>(false);
  const utils = api.useUtils();

  const handleEdit = () => {
    setIsEdit((prev) => !prev);
  };

  const handleClose = () => {
    onClose();
    handleEdit();
  };

  const handleSaveSuccess = () => {
    void utils.event.getUpcoming.invalidate();
    handleClose();
  };

  const {
    control,
    handleSubmit,
    isPending,
    formState: { isValid },
  } = useEventForm(event, handleSaveSuccess);

  return (
    <Modal isOpen={isOpen} size="lg" backdrop="blur" hideCloseButton>
      <ModalContent>
        <ModalHeader className="flex">
          <div>{event.name}</div>
          <div className="grow" />
          <EditableState state={state} eventId={event.id} />
        </ModalHeader>
        <ModalBody>
          {isEdit ? (
            <EventForm control={control} />
          ) : (
            <EventValues event={event} />
          )}
        </ModalBody>
        <ModalFooter>
          <Button onClick={handleClose} color="danger">
            Zavřít
          </Button>
          {isEdit ? (
            <Button
              color="primary"
              onClick={handleSubmit}
              isLoading={isPending}
              isDisabled={!isValid}
            >
              Uložit
            </Button>
          ) : (
            <Button color="primary" onClick={handleEdit}>
              Editovat
            </Button>
          )}
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}
