import { NextResponse, type NextRequest } from "next/server";

/**
 * Optimistic gate only: it bounces requests that carry no session cookie. Real authentication
 * and role checks happen server-side in requireUser/requireAdmin and in every route handler.
 */
export function proxy(request: NextRequest) {
  if (!request.cookies.has("vnum_session")) {
    const url = new URL("/sign-in", request.url);
    url.searchParams.set("next", request.nextUrl.pathname + request.nextUrl.search);
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/dashboard/:path*", "/admin/:path*"],
};
