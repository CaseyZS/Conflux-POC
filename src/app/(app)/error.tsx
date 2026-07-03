"use client";

// The app segment's error boundary. Next renders this (a client component, as
// required) when a server render or action under (app) throws — with `reset`
// to retry the failed render. Framework signals like redirect() and
// notFound() are re-thrown by Next, not caught here, so an expired session
// still bounces to /login and a notFound() still hits not-found.tsx. This is
// the deliberately generic "something broke" surface: friendly, recoverable,
// no stack traces in the demo.
import { useEffect } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="mx-auto flex max-w-md flex-col items-center gap-4 py-16 text-center">
      <div className="flex size-12 items-center justify-center rounded-full bg-destructive/10 text-2xl text-destructive">
        !
      </div>
      <h1 className="text-lg font-semibold tracking-tight">
        Something went wrong
      </h1>
      <p className="text-sm text-muted-foreground">
        That screen hit an unexpected error. You can try again, or head back to
        the dashboard.
      </p>
      <div className="flex items-center gap-2">
        <Button onClick={reset}>Try again</Button>
        <Button
          variant="outline"
          nativeButton={false}
          render={<Link href="/" />}
        >
          Go to dashboard
        </Button>
      </div>
    </div>
  );
}
