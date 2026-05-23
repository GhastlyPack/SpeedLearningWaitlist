import { NextResponse } from "next/server";
import { searchWaitlistPeople } from "@/lib/cio";

/**
 * Cheap "did anything change?" endpoint for the dashboard's signup poller.
 *
 * Returns the count of waitlist=true identifiers in CIO's first search
 * page (max 100). The client polls every 30s, compares to its baseline,
 * and triggers router.refresh() when the count increases — that re-runs
 * the dashboard's server component and fetches fresh GA/CIO/Meta data.
 *
 * Why first-page-only: we just need to detect change, not produce an
 * exact figure. One CIO search (no per-customer hydration) costs ~200ms
 * vs. ~2s for getWaitlistSummary. Once the waitlist exceeds 100 we'd
 * miss adds beyond the first page; revisit then.
 *
 * No auth: this endpoint leaks just an integer count, which is also
 * visible on the public lander as the "X people on the waitlist" copy
 * once we ship it. Keeping it open lets us call it from any client
 * without managing tokens. Internal/test signups are included in the
 * count (the dashboard filters them out at render time).
 */

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const resp = await searchWaitlistPeople(100);
    const count = (resp.identifiers || []).length;
    return NextResponse.json({
      count,
      hasMore: !!resp.next,
    });
  } catch (err) {
    return NextResponse.json(
      {
        count: null,
        error: err instanceof Error ? err.message : String(err),
      },
      { status: 200 }
    );
  }
}
