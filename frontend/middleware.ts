import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function middleware(req: NextRequest) {
  // Only check auth for /project routes
  const { pathname } = req.nextUrl;
  if (!pathname.startsWith("/project")) {
    return NextResponse.next();
  }

  // Check for next-auth session token cookie
  const hasSession = req.cookies.get("authjs.session-token") || req.cookies.get("__Secure-authjs.session-token");

  if (!hasSession) {
    const host = req.headers.get("x-forwarded-host") || req.headers.get("host") || "localhost:3340";
    const protocol = req.headers.get("x-forwarded-proto") || "http";
    const currentUrl = `${protocol}://${host}${pathname}${req.nextUrl.search}`;

    const loginUrl = new URL("/login", `${protocol}://${host}`);
    loginUrl.searchParams.set("callbackUrl", currentUrl);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/project/:path*"],
};
