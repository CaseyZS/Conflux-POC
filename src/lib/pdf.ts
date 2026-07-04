import { chromium } from "playwright";

// The PDF seam (G9): the one file that drives headless Chromium. Everything
// else asks for "this URL as a PDF" and never touches the browser directly —
// the same one-place discipline as the other lib/ seams, and the single import
// site Next keeps external (see next.config.ts).

export type PdfCookie = { name: string; value: string };

// Render an authenticated app URL to a PDF. The caller forwards the request's
// cookies so Chromium loads the page as the same signed-in user (the page's
// own requireActor still validates them). page.pdf() emulates print media, so
// the InvoiceDocument's `print:` variants apply automatically.
export async function renderUrlToPdf({
  url,
  origin,
  cookies,
}: {
  url: string;
  origin: string;
  cookies: PdfCookie[];
}): Promise<Buffer> {
  const browser = await chromium.launch();
  try {
    const context = await browser.newContext();
    if (cookies.length > 0) {
      // Scope every forwarded cookie to the origin (domain + path "/"), not the
      // deep print path, so a path-"/" session cookie is sent on the navigation.
      await context.addCookies(
        cookies.map((c) => ({ name: c.name, value: c.value, url: origin })),
      );
    }
    const page = await context.newPage();
    await page.goto(url, { waitUntil: "networkidle" });
    return await page.pdf({
      format: "A4",
      printBackground: true,
      margin: { top: "14mm", bottom: "14mm", left: "14mm", right: "14mm" },
    });
  } finally {
    await browser.close();
  }
}
