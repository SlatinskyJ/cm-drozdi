"use client";
import { NextUIProvider } from "@nextui-org/system";
import { useRouter } from "next/navigation";
import { type ReactNode } from "react";
import { TRPCReactProvider } from "~/trpc/react";

export default function Providers({ children }: { children: ReactNode }) {
  // eslint-disable-next-line @typescript-eslint/unbound-method
  const { push } = useRouter();

  return (
    <NextUIProvider navigate={push} className="h-full">
      <TRPCReactProvider>{children}</TRPCReactProvider>
    </NextUIProvider>
  );
}
