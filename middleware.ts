import { NextRequest, NextResponse } from "next/server";

// Edge runtime by default. Two responsibilities:
//   1. Rewrite dash.speedlearning.com/* -> /dashboard/* (same Next app serves both)
//   2. HTTP Basic Auth gate on /dashboard/* using DASHBOARD_PASSWORD

const DASHBOARD_PATH_PREFIX = "/dashboard";
const REALM = 'Basic realm="SpeedLearning Dashboard", charset="UTF-8"';

function unauthorized() {
  return new NextResponse("Authentication required.", {
    status: 401,
    headers: { "WWW-Authenticate": REALM },
  });
}

function constantTimeEquals(a: string, b: string): boolean {
  if (a.length !== b.length) {
    // Still iterate to make timing roughly constant relative to the longer side.
    let _accum = 0;
    const longer = a.length > b.length ? a : b;
    for (let i = 0; i < longer.length; i++) _accum |= 1;
    return false;
  }
  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return result === 0;
}

function checkBasicAuth(req: NextRequest): boolean {
  const expected = process.env.DASHBOARD_PASSWORD;
  if (!expected) return false;

  const authHeader = req.headers.get("authorization") || "";
  if (!authHeader.toLowerCase().startsWith("basic ")) return false;

  let decoded: string;
  try {
    decoded = atob(authHeader.slice(6).trim());
  } catch {
    return false;
  }

  // Format: username:password — username is ignored; we only validate password.
  const colonIdx = decoded.indexOf(":");
  const provided = colonIdx === -1 ? decoded : decoded.slice(colonIdx + 1);
  return constantTimeEquals(provided, expected);
}

export function middleware(req: NextRequest) {
  const host = (req.headers.get("host") || "").toLowerCase();
  const url = req.nextUrl;
  const isDashSubdomain = host.startsWith("dash.");

  // 1) Rewrite dash.* requests onto the /dashboard path of the same app.
  //    Leave /api routes alone (the dashboard subdomain shouldn't be hitting
  //    the marketing API endpoints, but if it does, fail cleanly with 404
  //    rather than smuggling into /dashboard/api/*).
  let rewriteTarget: URL | null = null;
  if (
    isDashSubdomain &&
    !url.pathname.startsWith(DASHBOARD_PATH_PREFIX) &&
    !url.pathname.startsWith("/api")
  ) {
    rewriteTarget = url.clone();
    rewriteTarget.pathname = DASHBOARD_PATH_PREFIX + (url.pathname === "/" ? "" : url.pathname);
  }

  // 2) Gate any /dashboard/* path with Basic Auth.
  const targetPath = rewriteTarget?.pathname || url.pathname;
  if (targetPath.startsWith(DASHBOARD_PATH_PREFIX)) {
    if (!checkBasicAuth(req)) return unauthorized();
  }

  if (rewriteTarget) return NextResponse.rewrite(rewriteTarget);
  return NextResponse.next();
}

export const config = {
  // Only run on dashboard paths AND on root when host is dash.* (caught via path === '/')
  // Easier to just match all paths — middleware is fast on Edge.
  matcher: ["/((?!_next/static|_next/image|favicon|icon|apple-icon|opengraph-image|.*\\.(?:ico|png|jpg|svg|woff|woff2|ttf|css|js|map)$).*)"],
};
