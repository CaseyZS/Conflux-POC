import Link from "next/link";
import { Button } from "@/components/ui/button";

// Rendered inside the app shell whenever a page under (app) calls notFound()
// — a bad ?date=, a missing invoice id, a stale link. Friendly and on-brand
// rather than the framework's bare 404.
export default function AppNotFound() {
  return (
    <div className="mx-auto flex max-w-md flex-col items-center gap-4 py-16 text-center">
      <p className="text-4xl font-semibold tracking-tight text-muted-foreground">
        404
      </p>
      <h1 className="text-lg font-semibold tracking-tight">
        We couldn&apos;t find that
      </h1>
      <p className="text-sm text-muted-foreground">
        The page you&apos;re after doesn&apos;t exist or may have moved.
      </p>
      <Button nativeButton={false} render={<Link href="/" />}>
        Go to dashboard
      </Button>
    </div>
  );
}
