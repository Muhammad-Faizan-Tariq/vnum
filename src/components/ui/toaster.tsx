"use client";

import { Toaster as Sonner } from "sonner";

export function Toaster() {
  return (
    <Sonner
      position="bottom-right"
      closeButton
      toastOptions={{
        classNames: {
          toast:
            "!border !border-border !bg-surface !text-foreground !shadow-md !rounded-lg !text-sm",
          description: "!text-muted-foreground",
          closeButton: "!border-border !bg-surface !text-foreground",
        },
      }}
    />
  );
}
