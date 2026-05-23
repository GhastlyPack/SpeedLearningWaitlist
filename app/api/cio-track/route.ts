import { NextRequest, NextResponse } from "next/server";
import crypto from "node:crypto";

/**
 * Customer.io Track API — server-side direct write to the Journeys workspace.
 *
 * This route replaces the browser-side cioanalytics (CDP) snippet entirely.
 * Why:
 *   - The CDP snippet gets blocked by ad blockers for ~25% of users.
 *   - CDP -> Journeys destination is a separate hop that can break (and did
 *     on May 21, 2026 — costing us ~30 signups from a live event before we
 *     diagnosed it).
 *   - Track API writes straight into the Journeys workspace with no CDP
 *     middleware involved. Same-origin POST from the browser also can't be
 *     intercepted by browser extensions.
 *
 * Also handles UTM attribution: the lander captures utm_*, fbclid, gclid,
 * ref, referrer, landing_page on first visit into a cookie (see lib/utms.ts),
 * and forwards them here on signup. They land as attributes on the CIO
 * person so the dashboard can break signups down by campaign / ad / referrer.
 *
 * Returns a referral_code derived from the email so the client can build
 * personalized share URLs that credit the referrer when their invitee joins.
 *
 * Required env:
 *   CIO_TRACK_SITE_ID  — Site ID from Workspace Settings -> API credentials.
 *   CIO_TRACK_API_KEY  — Track API key from the same panel. Secret, server-only.
 *
 * Optional env:
 *   CIO_REGION — "us" (default) or "eu". Determines the API host.
 */

const SITE_ID = process.env.CIO_TRACK_SITE_ID;
const API_KEY = process.env.CIO_TRACK_API_KEY;
const REGION = (process.env.CIO_REGION || "us").toLowerCase();

function getApiBase(): string {
  return REGION === "eu"
    ? "https://track-eu.customer.io/api/v1"
    : "https://track.customer.io/api/v1";
}

function basicAuthHeader(): string {
  return `Basic ${Buffer.from(`${SITE_ID}:${API_KEY}`).toString("base64")}`;
}

/**
 * Derive a referral code from the email. SHA-256(email) truncated to 12 hex
 * chars. Stable per email so the same person always shares the same code,
 * which lets us match `?ref=<code>` on signups against the existing
 * referral_code attribute to credit the referrer.
 */
function referralCodeFor(email: string): string {
  return crypto
    .createHash("sha256")
    .update(email.trim().toLowerCase())
    .digest("hex")
    .slice(0, 12);
}

interface CioTrackBody {
  email?: string;
  first_name?: string;
  last_name?: string;
  source?: string;
  signed_up_at?: string;
  // UTM / acquisition attributes (any may be undefined)
  utm_source?: string;
  utm_medium?: string;
  utm_campaign?: string;
  utm_content?: string;
  utm_term?: string;
  fbclid?: string;
  gclid?: string;
  ref?: string;
  referrer?: string;
  landing_page?: string;
}

export async function POST(req: NextRequest) {
  if (!SITE_ID || !API_KEY) {
    // Don't fail the form submission if creds aren't configured — return
    // a soft no-op so a misconfigured deploy doesn't lose data to a 5xx.
    console.warn("[cio-track] CIO_TRACK_SITE_ID or CIO_TRACK_API_KEY not set");
    return NextResponse.json(
      { ok: false, reason: "cio_track_credentials_unset" },
      { status: 200 }
    );
  }

  let body: CioTrackBody;
  try {
    body = (await req.json()) as CioTrackBody;
  } catch {
    return NextResponse.json(
      { ok: false, reason: "bad_json" },
      { status: 400 }
    );
  }

  const email = body.email?.trim().toLowerCase();
  const firstName = body.first_name?.trim();
  const lastName = body.last_name?.trim();
  if (!email) {
    return NextResponse.json(
      { ok: false, reason: "missing_email" },
      { status: 400 }
    );
  }

  const nowIso = body.signed_up_at || new Date().toISOString();
  const createdAt = Math.floor(new Date(nowIso).getTime() / 1000);
  const source = body.source || "speedlearning.com";
  const referralCode = referralCodeFor(email);

  const auth = basicAuthHeader();
  const base = getApiBase();
  const customerId = encodeURIComponent(email);

  // 1) Identify the customer (create or update with traits).
  const traits: Record<string, unknown> = {
    email,
    waitlist: true,
    waitlist_signed_up_at: nowIso,
    waitlist_source: source,
    created_at: createdAt,
    referral_code: referralCode,
  };
  if (firstName) traits.first_name = firstName;
  if (lastName) traits.last_name = lastName;

  // UTM / acquisition attributes (only set when present so we don't
  // overwrite a returning person's prior attribution with empty values).
  const acquisitionKeys: Array<keyof CioTrackBody> = [
    "utm_source",
    "utm_medium",
    "utm_campaign",
    "utm_content",
    "utm_term",
    "fbclid",
    "gclid",
    "referrer",
    "landing_page",
  ];
  for (const k of acquisitionKeys) {
    const v = body[k];
    if (typeof v === "string" && v.length > 0) {
      traits[k] = v;
    }
  }
  // Inbound referral code (this person was referred by someone with this code)
  if (typeof body.ref === "string" && body.ref.length > 0) {
    traits.referred_by = body.ref;
  }

  try {
    const identifyResp = await fetch(`${base}/customers/${customerId}`, {
      method: "PUT",
      headers: {
        Authorization: auth,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(traits),
    });

    if (!identifyResp.ok) {
      const errText = await identifyResp.text().catch(() => "");
      console.error(
        "[cio-track] identify failed",
        identifyResp.status,
        errText.slice(0, 300)
      );
      console.error("[cio-track] failed_email=", email);
      return NextResponse.json(
        {
          ok: false,
          reason: "identify_failed",
          status: identifyResp.status,
        },
        { status: 200 }
      );
    }

    // 2) Track the waitlist_signup event against the customer.
    const trackResp = await fetch(`${base}/customers/${customerId}/events`, {
      method: "POST",
      headers: {
        Authorization: auth,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        name: "waitlist_signup",
        data: {
          source,
          signed_up_at: nowIso,
          utm_source: body.utm_source,
          utm_medium: body.utm_medium,
          utm_campaign: body.utm_campaign,
          utm_content: body.utm_content,
          ref: body.ref,
        },
      }),
    });

    if (!trackResp.ok) {
      const errText = await trackResp.text().catch(() => "");
      console.error(
        "[cio-track] track event failed",
        trackResp.status,
        errText.slice(0, 300)
      );
    }

    // Recovery breadcrumb in Vercel logs.
    console.log(
      "[cio-track] ok",
      JSON.stringify({
        email,
        first_name: firstName,
        utm_source: body.utm_source,
        utm_campaign: body.utm_campaign,
      })
    );

    return NextResponse.json({
      ok: true,
      identify_status: identifyResp.status,
      track_status: trackResp.status,
      referral_code: referralCode,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[cio-track] exception", message);
    console.error("[cio-track] failed_email=", email);
    return NextResponse.json(
      { ok: false, reason: "exception", message },
      { status: 200 }
    );
  }
}
