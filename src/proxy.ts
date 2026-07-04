import { NextResponse, type NextRequest } from "next/server";

// Route guard, first line only. The proxy (Next 16's rename of "middleware")
// runs before every matched request, so a clearly logged-out visitor (no
// session cookie at all) is bounced to /login without rendering anything. It
// deliberately does NOT verify the cookie's contents — that would drag the
// auth stack into the proxy bundle. The authoritative check stays
// server-side: requireActor() in the pages (G3), which fully validates the
// session and membership. A forged cookie gets past this redirect and fails
// there.
const SESSION_COOKIES = [
  "authjs.session-token", // http (dev)
  "__Secure-authjs.session-token", // https (prod)
];

export default function proxy(request: NextRequest) {
  const hasSession = SESSION_COOKIES.some((name) => request.cookies.has(name));
  if (!hasSession) {
    return NextResponse.redirect(new URL("/login", request.url));
  }
  return NextResponse.next();
}

export const config = {
  // Everything except: the login page itself, Auth.js's own endpoints,
  // Next's static assets, and the favicon.
  matcher: ["/((?!login|api/auth|_next/static|_next/image|favicon.ico).*)"],
};
