import { Button } from "@/components/ui/button";

// A plain link to the PDF route — the response's attachment disposition makes
// the browser download it without leaving the page, so no client JS is needed.
export function DownloadPdfButton({ invoiceId }: { invoiceId: string }) {
  return (
    <Button
      variant="outline"
      size="sm"
      nativeButton={false}
      render={<a href={`/invoices/${invoiceId}/pdf`} />}
    >
      Download PDF
    </Button>
  );
}
