import { Button } from "@components/ui/Button";
import {
  Modal,
  ModalBody,
  ModalContent,
  ModalFooter,
  ModalHeader,
} from "@nextui-org/modal";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { type TEvent } from "~/app/_models/event";
import DeleteEvent from "~/app/events/_components/DeleteEvent";
import EditableState from "~/app/events/_components/EditableState";
import { EventForm } from "~/app/events/_components/EventForm";
import EventValues from "~/app/events/_components/EventValues";
import { useEventForm } from "~/app/events/_utils/useEventForm";
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
  const router = useRouter();

  const handleEdit = () => {
    setIsEdit((prev) => !prev);
  };

  const handleClose = () => {
    onClose();
    setIsEdit(false);
  };

  const handleSaveSuccess = () => {
    router.refresh();
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
        <ModalFooter className="flex">
          <Button onClick={handleClose} color="danger" variant="ghost">
            Zavřít
          </Button>
          <div className="grow" />
          <DeleteEvent eventId={event.id} onSuccess={handleClose} />
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
