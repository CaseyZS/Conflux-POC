import { cookies as requestCookies } from "next/headers";
import type { NextRequest } from "next/server";
import { requireActor } from "@/lib/auth";
import { requireCapability } from "@/lib/authz";
import { getInvoiceView } from "@/features/invoices/queries";
import { renderUrlToPdf } from "@/lib/pdf";

// Playwright needs the Node runtime, and the PDF is generated per request.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /invoices/:id/pdf — streams the finalized invoice as a PDF. Auth is the
// same capability the page needs; Chromium then re-loads the bare /print/:id
// route as this same user (cookies forwarded) and prints it (G9).
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ invoiceId: string }> },
) {
  const actor = requireCapability(await requireActor(), "invoice.manage");
  const { invoiceId } = await params;

  const invoice = await getInvoiceView(actor, invoiceId);
  if (!invoice || invoice.status === "draft") {
    return new Response("Not found", { status: 404 });
  }

  const origin = request.nextUrl.origin;
  const jar = await requestCookies();
  const forwarded = jar.getAll().map((c) => ({ name: c.name, value: c.value }));

  const pdf = await renderUrlToPdf({
    url: `${origin}/print/${invoiceId}`,
    origin,
    cookies: forwarded,
  });

  const filename = `${invoice.number ?? "invoice"}.pdf`;
  return new Response(new Uint8Array(pdf), {
    headers: {
      "content-type": "application/pdf",
      "content-disposition": `attachment; filename="${filename}"`,
    },
  });
}
