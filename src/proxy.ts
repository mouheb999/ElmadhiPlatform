import { NextResponse, type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

// Routes that require a signed-in, paid user.
const PROTECTED_PREFIXES = [
  "/dashboard",
  "/diet",
  "/workout",
  "/qa",
  "/settings",
];

// Renamed from `middleware` per Next.js 16 deprecation (middleware -> proxy).
export async function proxy(request: NextRequest) {
  const { response, supabase, user } = await updateSession(request);
  const { pathname } = request.nextUrl;

  const isProtected = PROTECTED_PREFIXES.some(
    (p) => pathname === p || pathname.startsWith(`${p}/`),
  );

  if (!isProtected) return response;

  // Must be signed in.
  if (!user) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }

  // Gate: only accounts an admin has activated can reach the app. Everyone
  // else is held on /checkout until their payment is confirmed. Admins always
  // pass (so they can use the app while reviewing requests).
  const { data: profile } = await supabase
    .from("profiles")
    .select("payment_status, is_admin")
    .eq("id", user.id)
    .maybeSingle();

  if (!profile?.is_admin && profile?.payment_status !== "active") {
    const url = request.nextUrl.clone();
    url.pathname = "/checkout";
    return NextResponse.redirect(url);
  }

  return response;
}

export const config = {
  // Run on everything except static assets and image optimizer.
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
