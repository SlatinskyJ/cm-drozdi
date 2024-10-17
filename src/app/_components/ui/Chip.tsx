"use client";
//extendVariants on server side throws error

import { Chip as NextChip } from "@nextui-org/chip";
import { extendVariants } from "@nextui-org/system";

export const Chip = extendVariants(NextChip, {
  variants: {
    color: {
      default: {
        base: ["bg-default-100"],
      },
      success: {
        base: ["text-default-100"],
      },
      unknown: {
        base: ["bg-unknown text-default-100"],
      },
    },
  },
});

export type ChipProps = React.ComponentProps<typeof Chip>;
