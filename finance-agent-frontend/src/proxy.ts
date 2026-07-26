// src/proxy.ts
import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function proxy(request: NextRequest) {
  let response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  });

  // 1. Initialize Supabase Server Client inside proxy
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          );
          response = NextResponse.next({
            request,
          });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  // 2. Refresh & Fetch the active user session
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;

  // RULE 1: Root path '/' always redirects unauthenticated/first-time users to '/signup'
  if (pathname === "/") {
    if (user) {
      return NextResponse.redirect(new URL("/analyse", request.url));
    }
    return NextResponse.redirect(new URL("/signup", request.url));
  }

  // RULE 2: If the user IS logged in, prevent them from accessing '/login' or '/signup'
  if (user && (pathname === "/login" || pathname === "/signup")) {
    return NextResponse.redirect(new URL("/analyse", request.url));
  }

  // RULE 3: If the user IS NOT logged in, block access to '/analyse'
  if (!user && pathname.startsWith("/analyse")) {
    return NextResponse.redirect(new URL("/signup", request.url));
  }

  return response;
}

// Ensure proxy runs on all relevant pages, ignoring static assets & API routes
export const config = {
  matcher: [
    "/",
    "/login",
    "/signup",
    "/analyse/:path*",
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
