import { NextRequest, NextResponse } from "next/server";
import {
  searchWaitlistPeople,
  getCustomerByCioId,
  classifyCioTraffic,
} from "@/lib/cio";

/**
 * One-shot backfill of the `traffic_type` attribute on every existing CIO
 * waitlist person. Going forward /api/cio-track writes this attribute at
 * signup time, but records created before that change have no value set.
 *
 * The dashboard already classifies on the fly (from utm_medium + fbclid),
 * so the dashboard filter works without this — but writing the attribute
 * back to CIO makes it queryable in segments and visible in the admin UI.
 *
 * Auth: requires DASHBOARD_PASSWORD as a bearer token. Same secret the
 * /dashboard subdomain uses, so anyone who can see the dashboard can
 * trigger the backfill (no separate ACL to manage).
 *
 * Idempotent. Safe to re-run.
 */

const SITE_ID = process.env.CIO_TRACK_SITE_ID;
const API_KEY = process.env.CIO_TRACK_API_KEY;
const REGION = (process.env.CIO_REGION || "us").toLowerCase();
const PASSWORD = process.env.DASHBOARD_PASSWORD;

function trackApiBase(): string {
  return REGION === "eu"
    ? "https://track-eu.customer.io/api/v1"
    : "https://track.customer.io/api/v1";
}

function basicAuthHeader(): string {
  return `Basic ${Buffer.from(`${SITE_ID}:${API_KEY}`).toString("base64")}`;
}

export async function POST(req: NextRequest) {
  if (!SITE_ID || !API_KEY) {
    return NextResponse.json(
      { ok: false, reason: "cio_track_credentials_unset" },
      { status: 500 }
    );
  }
  if (!PASSWORD) {
    return NextResponse.json(
      { ok: false, reason: "dashboard_password_unset" },
      { status: 500 }
    );
  }

  const auth = req.headers.get("authorization") || "";
  const provided = auth.startsWith("Bearer ") ? auth.slice(7) : "";
  if (provided !== PASSWORD) {
    return NextResponse.json({ ok: false, reason: "unauthorized" }, { status: 401 });
  }

  // Page through CIO waitlist search to collect every cio_id.
  // Deduplicates + loop-detects (see lib/cio.ts getWaitlistSummary for
  // the failure mode this defends against).
  const allCioIds: string[] = [];
  const seenCioIds = new Set<string>();
  let cursor: string | undefined;
  for (let page = 0; page < 50; page++) {
    const resp = await searchWaitlistPeople(100, cursor);
    let newOnThisPage = 0;
    for (const ident of resp.identifiers || []) {
      if (ident.cio_id && !seenCioIds.has(ident.cio_id)) {
        seenCioIds.add(ident.cio_id);
        allCioIds.push(ident.cio_id);
        newOnThisPage++;
      }
    }
    if (newOnThisPage === 0) {
      if (page > 0) {
        console.warn(
          `[backfill] pagination yielded no new records on page ${page}; breaking`
        );
      }
      break;
    }
    if (!resp.next) break;
    cursor = resp.next;
  }

  const cioBase = trackApiBase();
  const cioAuth = basicAuthHeader();

  let paid = 0;
  let organic = 0;
  let skipped = 0;
  let failed = 0;
  const errors: string[] = [];

  // Hydrate in modest batches to avoid hammering CIO. The App API is the
  // read side; Track API is the write side. We do one of each per person.
  const concurrency = 5;
  for (let i = 0; i < allCioIds.length; i += concurrency) {
    const batch = allCioIds.slice(i, i + concurrency);
    await Promise.all(
      batch.map(async (cid) => {
        const person = await getCustomerByCioId(cid);
        if (!person) {
          skipped++;
          return;
        }
        // classifyCioTraffic only needs utm_medium + fbclid presence.
        const trafficType = classifyCioTraffic({
          utmMedium: person.utmMedium,
          fbclidPresent: !!person.fbclidPresent,
        });
        if (trafficType === "paid") paid++;
        else organic++;

        // PUT updates only the traffic_type trait — other attributes
        // are preserved by CIO when partial updates are sent.
        const customerId = encodeURIComponent(person.email);
        const resp = await fetch(`${cioBase}/customers/${customerId}`, {
          method: "PUT",
          headers: {
            Authorization: cioAuth,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ traffic_type: trafficType }),
        });
        if (!resp.ok) {
          failed++;
          const text = await resp.text().catch(() => "");
          errors.push(`${person.email}: ${resp.status} ${text.slice(0, 80)}`);
        }
      })
    );
  }

  return NextResponse.json({
    ok: true,
    scanned: allCioIds.length,
    paid,
    organic,
    skipped,
    failed,
    errorsSample: errors.slice(0, 5),
  });
}
