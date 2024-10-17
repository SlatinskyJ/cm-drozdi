"use client";
//extendVariants on server side throws error

import { Chip as NextChip } from "@nextui-org/chip";
import { extendVariants } from "@nextui-org/system";

export const Chip = extendVariants(NextChip, {
  variants: {
    color: {
      default: {
        base: ["bg-white"],
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
