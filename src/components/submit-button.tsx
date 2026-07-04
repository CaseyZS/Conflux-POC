"use client";

import { useFormStatus } from "react-dom";
import { Button } from "@/components/ui/button";

// Submit button that disables itself while the enclosing <form action> is in
// flight. useFormStatus only works from inside the form, which is why this is
// its own component instead of logic in each form's parent.
export function SubmitButton({
  pendingText,
  children,
  ...props
}: React.ComponentProps<typeof Button> & { pendingText?: string }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending} {...props}>
      {pending ? (pendingText ?? children) : children}
    </Button>
  );
}
