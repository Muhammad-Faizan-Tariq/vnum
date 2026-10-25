"use client";

import { useEffect } from "react";
import { TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/primitives";

export default function DashboardError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);
  return (
    <EmptyState
      icon={TriangleAlert}
      title="Something went wrong"
      description={`This page couldn't be loaded.${error.digest ? ` Reference: ${error.digest}.` : ""} If the problem continues, check that the database is reachable.`}
      action={<Button onClick={reset}>Try again</Button>}
    />
  );
}
