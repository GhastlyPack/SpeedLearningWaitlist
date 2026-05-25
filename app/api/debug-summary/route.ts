import { NextRequest, NextResponse } from "next/server";
import {
  searchWaitlistPeople,
  getCustomerByCioId,
  getHydrationStats,
  type WaitlistPerson,
} from "@/lib/cio";

interface SearchIdentifierLite {
  cio_id?: string;
  email?: string;
}

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

  // Stage 1: page through CIO search to collect full identifiers
  // (cio_id + email — the email gets passed to the fallback path so
  // the debug numbers match what the dashboard actually sees).
  const allIdentifiers: SearchIdentifierLite[] = [];
  let cursor: string | undefined;
  let pages = 0;
  for (let page = 0; page < 20; page++) {
    pages = page + 1;
    const resp = await searchWaitlistPeople(100, cursor);
    for (const ident of resp.identifiers || []) {
      if (ident.cio_id) allIdentifiers.push(ident);
    }
    if (!resp.next) break;
    cursor = resp.next;
  }

  // Stage 2: hydrate each one with fallback enabled (mirrors dashboard
  // behavior). To still see the raw failure rate, we do two passes per
  // batch — one without fallback (counts direct hydration), one with
  // fallback (matches dashboard). Doubles CIO API load but this endpoint
  // is human-invoked so it's fine.
  const concurrency = 10;
  const directHydrated: (WaitlistPerson | null)[] = [];
  const withFallback: (WaitlistPerson | null)[] = [];
  for (let i = 0; i < allIdentifiers.length; i += concurrency) {
    const batch = allIdentifiers.slice(i, i + concurrency);
    const direct = await Promise.all(
      batch.map((ident) => getCustomerByCioId(ident.cio_id as string))
    );
    directHydrated.push(...direct);
    const rescued = await Promise.all(
      batch.map((ident) =>
        getCustomerByCioId(ident.cio_id as string, ident.email)
      )
    );
    withFallback.push(...rescued);
  }
  const hydratedNonNull = directHydrated.filter(
    (p): p is WaitlistPerson => p !== null
  );
  const hydrateFailedCount = allIdentifiers.length - hydratedNonNull.length;
  const finalNonNull = withFallback.filter(
    (p): p is WaitlistPerson => p !== null
  );
  const rescuedByFallback = finalNonNull.length - hydratedNonNull.length;

  // Stage 3: apply the internal-email filter on the rescued set —
  // this is what the dashboard actually counts.
  const afterInternalFilter = finalNonNull.filter((p) => !p.internal);

  // Stage 4: sample the most recent records (sorted by signedUpAt desc,
  // same as the dashboard). Drawn from the rescued set so fallback
  // records appear here too — useful for confirming Brandon-style
  // records make it through.
  const recentSample = [...finalNonNull]
    .sort((a, b) => (b.signedUpAt || "").localeCompare(a.signedUpAt || ""))
    .slice(0, 20)
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
      // Heuristic: records the fallback rescued have no firstName +
      // no utmSource AND a brand-new signedUpAt timestamp.
      isFallback:
        p.firstName === undefined &&
        p.utmSource === undefined &&
        p.signedUpAt !== undefined &&
        Date.now() - new Date(p.signedUpAt).getTime() < 5 * 60_000,
    }));

  return NextResponse.json({
    ok: true,
    pagesScanned: pages,
    searchCioIds: allIdentifiers.length,
    hydratedNonNull: hydratedNonNull.length,
    hydrateFailedCount,
    rescuedByFallback,
    finalCount: finalNonNull.length,
    afterInternalFilter: afterInternalFilter.length,
    // Hydration cache stats. Cache hits = records served from memory
    // without an API call. High hit rate = stable dashboard. After
    // a few loads on a warm instance, hits should dominate.
    cache: getHydrationStats(),
    recentSample,
    byVariant: finalNonNull.reduce<Record<string, number>>((acc, p) => {
      acc[p.variant] = (acc[p.variant] || 0) + 1;
      return acc;
    }, {}),
    byInternal: {
      internal: finalNonNull.filter((p) => p.internal).length,
      external: finalNonNull.filter((p) => !p.internal).length,
    },
  });
}
