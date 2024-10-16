"use client";

import { Button } from "@components/ui/Button";
import {
  Dropdown,
  DropdownItem,
  DropdownMenu,
  DropdownTrigger,
} from "@nextui-org/dropdown";

export default function Menu() {
  return (
    <Dropdown>
      <DropdownTrigger>
        <Button
          color="primary"
          className="rounded-full bg-opacity-60 font-bold hover:bg-opacity-100"
        >
          Menu
        </Button>
      </DropdownTrigger>
      <DropdownMenu>
        <DropdownItem key="home" href="/">
          Domů
        </DropdownItem>
        <DropdownItem key="events" href="/events">
          Události
        </DropdownItem>
        <DropdownItem key="members" href="/members">
          Členové
        </DropdownItem>
      </DropdownMenu>
    </Dropdown>
  );
}
