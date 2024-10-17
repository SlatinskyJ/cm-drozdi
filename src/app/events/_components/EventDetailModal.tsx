import { Button } from "@components/ui/Button";
import { Chip } from "@components/ui/Chip";
import {
  Modal,
  ModalBody,
  ModalContent,
  ModalFooter,
  ModalHeader,
} from "@nextui-org/modal";
import { type TEvent } from "~/app/_models/event";
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
  return (
    <Modal isOpen={isOpen} size="lg" backdrop="blur" hideCloseButton>
      <ModalContent>
        <ModalHeader className="flex">
          <div>{event.name}</div>
          <div className="grow" />
          <Chip color={state.color}>{state.label}</Chip>
        </ModalHeader>
        <ModalBody>TEst</ModalBody>
        <ModalFooter>
          <Button onClick={onClose} color="danger">
            Zavřít
          </Button>
          <Button color="primary">Editovat</Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}
