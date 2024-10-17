import {
  Dropdown as NextDropdown,
  DropdownItem as NextDropdownItem,
  DropdownMenu as NextDropdownMenu,
  DropdownTrigger as NextDropdownTrigger,
} from "@nextui-org/dropdown";
import { extendVariants } from "@nextui-org/system";

export const Dropdown = extendVariants(NextDropdown, {});
export const DropdownTrigger = extendVariants(NextDropdownTrigger, {});
export const DropdownMenu = extendVariants(NextDropdownMenu, {
  defaultVariants: {
    color: "primary",
  },
});
export const DropdownItem = extendVariants(NextDropdownItem, {});
