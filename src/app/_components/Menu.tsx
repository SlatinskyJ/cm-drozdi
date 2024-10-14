"use client";
import { Button } from "@nextui-org/button";
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
        <Button className="rounded-full bg-black/70 font-bold text-white hover:bg-black">
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
