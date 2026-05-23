import { NextRequest, NextResponse } from "next/server";
import crypto from "node:crypto";

// Meta Conversions API server-side handler.
//
// This is the SOLE source of the "Lead" standard event going to Meta. The
// browser Pixel still loads in layout.tsx and fires PageView (used for
// retargeting and Custom Audiences), but the Lead conversion event is only
// fired from here — server-side. Trade-off: marginally less browser-side
// signal, but guaranteed single-count per signup with no dedup risk, and
// resilient to ad blockers / iOS 14+ tracking restrictions.
//
// The event_id we still attach acts as a server-side idempotency token in
// case Meta ingests this event more than once (e.g. on a retry).
//
// Required env: META_CAPI_TOKEN (server-only, never exposed to the browser).
// If the token is unset the route is a no-op (returns ok:false silently)
// so deploys without it don't break the form submission.

const PIXEL_ID =
  process.env.NEXT_PUBLIC_META_PIXEL_ID || "2100944364633594";
const ACCESS_TOKEN = process.env.META_CAPI_TOKEN;
const META_API_VERSION = "v23.0";

function sha256Lower(value?: string | null): string | undefined {
  if (!value) return undefined;
  const normalized = value.trim().toLowerCase();
  if (!normalized) return undefined;
  return crypto.createHash("sha256").update(normalized).digest("hex");
}

interface CapiBody {
  event_id?: string;
  email?: string;
  first_name?: string;
  last_name?: string;
  fbp?: string;
  fbc?: string;
  event_source_url?: string;
}

export async function POST(req: NextRequest) {
  if (!ACCESS_TOKEN) {
    // Token not configured — fail silently so the form still works.
    return NextResponse.json(
      { ok: false, reason: "capi_token_unset" },
      { status: 200 }
    );
  }

  let body: CapiBody;
  try {
    body = (await req.json()) as CapiBody;
  } catch {
    return NextResponse.json(
      { ok: false, reason: "bad_json" },
      { status: 400 }
    );
  }

  const { event_id, email, first_name, last_name, fbp, fbc, event_source_url } =
    body;

  if (!event_id || !email) {
    return NextResponse.json(
      { ok: false, reason: "missing_fields" },
      { status: 400 }
    );
  }

  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("x-real-ip") ||
    undefined;
  const ua = req.headers.get("user-agent") || undefined;

  const userData: Record<string, unknown> = {};
  const em = sha256Lower(email);
  const fn = sha256Lower(first_name);
  const ln = sha256Lower(last_name);
  if (em) userData.em = [em];
  if (fn) userData.fn = [fn];
  if (ln) userData.ln = [ln];
  if (ip) userData.client_ip_address = ip;
  if (ua) userData.client_user_agent = ua;
  if (fbp) userData.fbp = fbp;
  if (fbc) userData.fbc = fbc;

  const payload = {
    data: [
      {
        event_name: "Lead",
        event_time: Math.floor(Date.now() / 1000),
        event_id,
        event_source_url: event_source_url || "https://speedlearning.com",
        action_source: "website",
        user_data: userData,
        custom_data: {
          content_name: "SpeedLearning Waitlist",
          value: 0,
          currency: "USD",
        },
      },
    ],
  };

  const url = `https://graph.facebook.com/${META_API_VERSION}/${PIXEL_ID}/events?access_token=${encodeURIComponent(
    ACCESS_TOKEN
  )}`;

  try {
    const resp = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!resp.ok) {
      const errText = await resp.text();
      console.error(
        "[meta-capi] graph api error",
        resp.status,
        errText.slice(0, 500)
      );
      return NextResponse.json(
        { ok: false, reason: "meta_api_error", status: resp.status },
        { status: 200 }
      );
    }

    const json = (await resp.json()) as { events_received?: number };
    return NextResponse.json({ ok: true, events_received: json.events_received });
  } catch (err) {
    console.error(
      "[meta-capi] exception",
      err instanceof Error ? err.message : String(err)
    );
    return NextResponse.json(
      { ok: false, reason: "exception" },
      { status: 200 }
    );
  }
}
