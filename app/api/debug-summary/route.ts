import { NextRequest, NextResponse } from "next/server";
import {
  searchWaitlistPeople,
  getCustomerByCioId,
  type WaitlistPerson,
} from "@/lib/cio";

/**
 * Diagnostic endpoint that returns the raw data flow at every step of
 * getWaitlistSummary, so we can see exactly where signups are being
 * dropped if the dashboard count doesn't match Customer.io.
 *
 * Auth via DASHBOARD_PASSWORD bearer token (same as /api/backfill-traffic).
 *
 * Returns each filter stage:
 *   1. searchCioIds        — count returned by CIO's search endpoint
 *   2. hydratedNonNull     — count after per-person attribute fetch
 *                            (drops happen here if getCustomerByCioId
 *                             throws and the catch returns null)
 *   3. afterInternalFilter — count after filtering out @bowskyventures.com
 *   4. recent samples      — last 10 hydrated emails by signedUpAt, with
 *                            their key attributes, so we can see what's
 *                            (or isn't) in the visible feed
 *
 * If searchCioIds is the right number but hydratedNonNull is lower, the
 * issue is in hydration. If both numbers match Customer.io but the
 * dashboard still shows less, the issue is downstream (rendering /
 * caching).
 */

const PASSWORD = process.env.DASHBOARD_PASSWORD;

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
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

  // Stage 1: page through CIO search to collect every cio_id
  const allCioIds: string[] = [];
  let cursor: string | undefined;
  let pages = 0;
  for (let page = 0; page < 20; page++) {
    pages = page + 1;
    const resp = await searchWaitlistPeople(100, cursor);
    for (const ident of resp.identifiers || []) {
      if (ident.cio_id) allCioIds.push(ident.cio_id);
    }
    if (!resp.next) break;
    cursor = resp.next;
  }

  // Stage 2: hydrate each one, count nulls (= records that errored)
  const concurrency = 10;
  const hydrated: (WaitlistPerson | null)[] = [];
  for (let i = 0; i < allCioIds.length; i += concurrency) {
    const batch = allCioIds.slice(i, i + concurrency);
    const results = await Promise.all(batch.map((cid) => getCustomerByCioId(cid)));
    hydrated.push(...results);
  }
  const hydratedNonNull = hydrated.filter(
    (p): p is WaitlistPerson => p !== null
  );
  const hydrateFailedCount = allCioIds.length - hydratedNonNull.length;

  // Stage 3: apply the internal-email filter (the dashboard does this)
  const afterInternalFilter = hydratedNonNull.filter((p) => !p.internal);

  // Stage 4: sample the most recent hydrated records (sorted by
  // signedUpAt desc, same as the dashboard does)
  const recentSample = [...hydratedNonNull]
    .sort((a, b) => (b.signedUpAt || "").localeCompare(a.signedUpAt || ""))
    .slice(0, 15)
    .map((p) => ({
      email: p.email,
      firstName: p.firstName,
      signedUpAt: p.signedUpAt,
      variant: p.variant,
      trafficType: p.trafficType,
      internal: p.internal ?? false,
      utmMedium: p.utmMedium,
      utmSource: p.utmSource,
      cioId: p.cioId,
    }));

  return NextResponse.json({
    ok: true,
    pagesScanned: pages,
    searchCioIds: allCioIds.length,
    hydratedNonNull: hydratedNonNull.length,
    hydrateFailedCount,
    afterInternalFilter: afterInternalFilter.length,
    recentSample,
    // Quick variant breakdown for visibility
    byVariant: hydratedNonNull.reduce<Record<string, number>>((acc, p) => {
      acc[p.variant] = (acc[p.variant] || 0) + 1;
      return acc;
    }, {}),
    byInternal: {
      internal: hydratedNonNull.filter((p) => p.internal).length,
      external: hydratedNonNull.filter((p) => !p.internal).length,
    },
  });
}
