import { Button } from "@/components/ui/button";

// Opens the polished invoice document (the shell-free /print surface) in a new
// tab, so a draft can be seen exactly as it will look — without finalizing.
// The document stamps a draft DRAFT, so a preview is never mistaken for a real
// invoice.
export function PreviewButton({ invoiceId }: { invoiceId: string }) {
  return (
    <Button
      variant="outline"
      size="sm"
      nativeButton={false}
      render={
        <a
          href={`/print/${invoiceId}`}
          target="_blank"
          rel="noopener noreferrer"
        />
      }
    >
      Preview
    </Button>
  );
}
