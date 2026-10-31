import { sessionSigningKey } from "@/lib/session-secret";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { jwtVerify } from "jose";

const PROTECTED_PREFIXES = [
  "/dashboard",
  "/account",
  "/inventory",
  "/intake",
  "/disposal",
  "/missing",
  "/reports",
  "/admin",
  "/scan",
  "/physical-inventory",
  "/data-engine",
  "/master-data",
];

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const isProtected = PROTECTED_PREFIXES.some((prefix) =>
    pathname.startsWith(prefix)
  );

  const token = request.cookies.get("custodia_session")?.value;

  if (isProtected) {
    if (!token) {
      const loginUrl = new URL("/login", request.url);
      loginUrl.searchParams.set("redirect", pathname);
      return NextResponse.redirect(loginUrl);
    }

    try {
      const { payload } = await jwtVerify(token, sessionSigningKey());
      const role = payload.role as string;

      // Audit pages/actions validate the current database role. Cookie roles may be stale.
      const isAuditRoute = pathname === "/admin/security-audit" || pathname.startsWith("/admin/security-audit/");
      if (pathname.startsWith("/admin") && !isAuditRoute && role !== "ADMIN" && role !== "AUDITOR") {
        return NextResponse.redirect(new URL("/dashboard", request.url));
      }
    } catch {
      const loginUrl = new URL("/login", request.url);
      return NextResponse.redirect(loginUrl);
    }
  }

  // Allow reauthentication even with a valid but deactivated/stale session cookie.
  // Current-account checks live in the server data layer, not the JWT claims.
  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!api|_next/static|_next/image|favicon.ico|manifest.json|icons).*)",
  ],
};
