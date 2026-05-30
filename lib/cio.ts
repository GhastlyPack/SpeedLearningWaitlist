/**
 * Customer.io App API client.
 *
 * Reads waitlist signups for the team dashboard.
 *
 * Required env:
 *   CIO_APP_API_KEY — App API token (Bearer). Server-only, marked sensitive.
 *   CIO_REGION      — "us" (default) or "eu". Determines the API host.
 *
 * Implementation notes:
 *   - Customers created via the CDP/cioanalytics snippet have `id: null` and
 *     are addressed via their `cio_id` instead. So the attribute lookup must
 *     use `/v1/api/customers/{cio_id}/attributes?id_type=cio_id`.
 *   - The search endpoint accepts a JSON filter and returns identifiers only;
 *     attributes require a separate per-customer GET.
 */

import { isInternalEmail } from "@/lib/internal";

type Region = "us" | "eu";

function getConfig() {
  const key = process.env.CIO_APP_API_KEY;
  if (!key) throw new Error("CIO_APP_API_KEY env var is not set.");
  const region = ((process.env.CIO_REGION || "us").toLowerCase() as Region);
  const host =
    region === "eu"
      ? "https://api-eu.customer.io"
      : "https://api.customer.io";
  return { key, host };
}

async function cioFetch<T = unknown>(
  path: string,
  init?: RequestInit
): Promise<T> {
  const { key, host } = getConfig();
  const url = path.startsWith("http") ? path : `${host}${path}`;
  const res = await fetch(url, {
    ...init,
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
      Accept: "application/json",
      ...(init?.headers || {}),
    },
    cache: "no-store",
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(
      `Customer.io API ${res.status} ${res.statusText} for ${path}: ${text.slice(0, 300)}`
    );
  }

  return (await res.json()) as T;
}

// -----------------------------------------------------------------------------
// Types

export interface WaitlistPerson {
  cioId: string;
  email: string;
  firstName?: string;
  lastName?: string;
  source?: string;
  signedUpAt?: string; // ISO
  // Acquisition attributes captured at signup (may be undefined for
  // direct/QR-code/pre-UTM signups).
  // Convention for Meta-driven traffic (set via URL-parameter templates):
  //   utmCampaign -> campaign name
  //   utmTerm     -> adset name
  //   utmContent  -> ad (creative) name
  utmSource?: string;
  utmMedium?: string;
  utmCampaign?: string;
  utmTerm?: string;
  utmContent?: string;
  referredBy?: string;
  /** True if fbclid was present on the signup landing URL (came from a
   *  Meta ad click). Used together with utm_medium to classify paid vs
   *  organic signups in the dashboard. */
  fbclidPresent?: boolean;
  /** Computed at hydrate time. "paid" if utm_medium signals a paid channel
   *  or fbclid was present; "organic" otherwise. */
  trafficType: "paid" | "organic";
  /** Lander variant the signup came from. "control" for the root lander,
   *  otherwise a slug matching one of VARIANTS in lib/variants.ts. Defaults
   *  to "control" for older records that pre-date variant tracking. */
  variant: string;
  /** True if the email belongs to an internal team domain (e.g.
   *  @bowskyventures.com). Filtered out of dashboard counts; left in CIO
   *  so we can verify the confirmation email flow without polluting metrics. */
  internal?: boolean;
  /** True if this record came through the fallback path (CIO's
   *  /attributes endpoint failed even after retry). Such records have
   *  only the email + cio_id from the search response; the rest is
   *  placeholder defaults. They still count toward the dashboard total
   *  but are excluded from the Recent Signups visual list so the table
   *  doesn't fill up with "—" / "direct" / "3s ago" rows when CIO is
   *  flaky. The next page load with successful hydration replaces them
   *  with the real record. */
  partial?: boolean;
}

export interface WaitlistSummary {
  total: number;
  recent: WaitlistPerson[];
  /** Map of "YYYY-MM-DD" (UTC) -> signup count. Used to draw the dashboard
   *  daily-trend chart from the canonical CIO source instead of GA event counts. */
  dailySignups: Record<string, number>;
  /** Same map but split by classified traffic type. The dashboard's
   *  paid/organic/all filter consults these to break out signup counts. */
  dailySignupsByTraffic: {
    paid: Record<string, number>;
    organic: Record<string, number>;
  };
  /** Total counts per traffic-type bucket. all === paid + organic. */
  totalByTraffic: {
    paid: number;
    organic: number;
    all: number;
  };
  /** Per-variant daily signups map: { variantSlug → { date → count } }.
   *  The dashboard's Variant filter sums over this to produce range-
   *  bucketed counts for the active variant. Includes "control". */
  dailySignupsByVariant: Record<string, Record<string, number>>;
  /** Total signups per variant. Used for at-a-glance per-variant counts
   *  on the dashboard and to populate the Variant dropdown options. */
  totalByVariant: Record<string, number>;
}

interface SearchIdentifier {
  cio_id: string;
  id?: string | null;
  email?: string;
}

interface SearchResponse {
  identifiers: SearchIdentifier[];
  next?: string | null;
}

interface CustomerAttributesResponse {
  customer: {
    id?: string;
    identifiers: { cio_id: string; email?: string; id?: string };
    attributes: Record<string, string>;
    timestamps: Record<string, number>;
    unsubscribed?: boolean;
  };
}

// -----------------------------------------------------------------------------
// Helpers

function attrString(
  attrs: Record<string, string> | undefined,
  key: string
): string | undefined {
  if (!attrs) return undefined;
  const v = attrs[key];
  return typeof v === "string" && v.length > 0 ? v : undefined;
}

function fromTimestampSeconds(seconds?: number): string | undefined {
  if (!seconds || !Number.isFinite(seconds)) return undefined;
  return new Date(seconds * 1000).toISOString();
}

/**
 * Classify a CIO waitlist person as paid- or organic-acquired based on the
 * acquisition attributes captured at signup.
 *
 * Paid signals (any one wins):
 *   - utm_medium in {paid_social, cpc, ppc, paid_search, display, paid}
 *   - fbclid present (came directly from a Meta ad click, regardless of UTMs)
 *
 * Everything else is organic: direct, referrals, organic search/social,
 * shared links, etc. The classification matches the GA channel-group
 * bucketing so paid/organic comparisons line up across data sources.
 */
const PAID_MEDIUMS = new Set([
  "paid_social",
  "cpc",
  "ppc",
  "paid_search",
  "display",
  "paid",
]);

export function classifyCioTraffic(args: {
  utmMedium?: string;
  fbclidPresent?: boolean;
}): "paid" | "organic" {
  const medium = (args.utmMedium || "").toLowerCase();
  if (medium && PAID_MEDIUMS.has(medium)) return "paid";
  if (args.fbclidPresent) return "paid";
  return "organic";
}

/**
 * Manual traffic-type overrides for records the automatic classifier gets
 * wrong. Typically: signups from a paid ad that landed without UTMs or
 * fbclid (e.g. before tracking was wired up, or after a user pasted the
 * naked domain into their address bar after seeing the ad).
 *
 * These take precedence over both the stored CIO `traffic_type` attribute
 * and the computed-from-attribution fallback. Matched by case-insensitive
 * (first_name + last_name) pair — we use names rather than emails because
 * the dashboard masks emails for privacy and looking them up in CIO each
 * time is a hassle.
 */
const NAME_TRAFFIC_OVERRIDES: ReadonlyArray<{
  firstName: string;
  lastName: string;
  trafficType: "paid" | "organic";
  reason: string;
}> = [
  // Three Meta-ad signups from before UTM/fbclid capture was fully wired.
  // Show up as "direct" source in the dashboard, but they came via ads —
  // explains the 6-event Meta-side discrepancy (3 signups doubled during
  // the pre-dedup era).
  { firstName: "Edgar", lastName: "Engibarian", trafficType: "paid", reason: "Pre-tracking Meta ad signup" },
  { firstName: "NP", lastName: "Duwal", trafficType: "paid", reason: "Pre-tracking Meta ad signup" },
  { firstName: "Phillip", lastName: "Coker", trafficType: "paid", reason: "Pre-tracking Meta ad signup" },
  { firstName: "Christopher", lastName: "Vazquez", trafficType: "paid", reason: "Pre-tracking Meta ad signup" },
];

function nameTrafficOverride(
  firstName?: string,
  lastName?: string
): "paid" | "organic" | undefined {
  if (!firstName || !lastName) return undefined;
  const f = firstName.trim().toLowerCase();
  const l = lastName.trim().toLowerCase();
  const match = NAME_TRAFFIC_OVERRIDES.find(
    (o) => o.firstName.toLowerCase() === f && o.lastName.toLowerCase() === l
  );
  return match?.trafficType;
}

// -----------------------------------------------------------------------------
// Queries

/**
 * Search People with the `waitlist` attribute set to `"true"`.
 *
 * Returns lightweight identifiers; hydrate via `getCustomerByCioId`.
 */
export async function searchWaitlistPeople(
  limit: number = 100,
  start?: string
): Promise<SearchResponse> {
  const body = {
    filter: {
      and: [
        {
          attribute: {
            field: "waitlist",
            operator: "eq",
            value: "true",
          },
        },
      ],
    },
    ...(start ? { start } : {}),
  };

  const qs = new URLSearchParams({ limit: String(limit) });

  return cioFetch<SearchResponse>(
    `/v1/api/customers?${qs.toString()}`,
    {
      method: "POST",
      body: JSON.stringify(body),
    }
  );
}

// -----------------------------------------------------------------------------
// Hydration cache
//
// Customer.io waitlist records are write-once: once a person signs up,
// their email, name, signedUpAt, UTMs, and variant don't change. Re-
// fetching the same record on every dashboard load is wasteful and
// directly causes the visible "now you see it, now you don't" issue
// when CIO's /attributes endpoint flakes out.
//
// Module-level Map. Lives for the lifetime of the serverless instance —
// survives across requests on a warm Vercel function, lost on cold
// start. Good enough for our scale (low traffic, growing waitlist) and
// trivially upgradeable to Vercel KV if we ever need cross-instance
// persistence.
//
// Resolution order in getCustomerByCioId becomes:
//   1. Fresh cache entry (≤ TTL) → serve from cache, no API call
//   2. Cache miss or expired → try CIO with retry
//   3. On CIO success → update cache, return fresh
//   4. On CIO failure WITH stale cache → return stale cache (better than
//      a placeholder fallback — last-known-good is real data)
//   5. On CIO failure WITHOUT cache → partial fallback (only path that
//      produces the dashboard's "—" placeholder rows)

interface HydrationCacheEntry {
  person: WaitlistPerson;
  cachedAt: number;
}

const HYDRATION_CACHE = new Map<string, HydrationCacheEntry>();
// 24 hours. Long enough that occasional CIO-admin attribute edits
// (e.g. flipping traffic_type manually) propagate within a day, short
// enough to keep memory bounded. Stale entries are STILL returned on
// CIO failure — TTL just controls when we attempt a fresh fetch.
const CACHE_TTL_MS = 24 * 60 * 60 * 1000;

const HYDRATION_STATS = {
  cacheHits: 0,
  cacheStaleServed: 0,
  freshFetched: 0,
  retrySucceeded: 0,
  partialFallbacks: 0,
};

function cacheIsFresh(entry: HydrationCacheEntry, now: number): boolean {
  return now - entry.cachedAt < CACHE_TTL_MS;
}

/**
 * Diagnostic snapshot of the in-memory hydration cache. Exposed via
 * /api/debug-summary so the cache hit rate is visible.
 */
export function getHydrationStats() {
  return {
    cacheSize: HYDRATION_CACHE.size,
    ...HYDRATION_STATS,
  };
}

/**
 * Full attribute fetch for one customer addressed by cio_id.
 *
 * Accepts an optional fallbackEmail. When the attribute fetch fails
 * (which happens transiently for very-recent signups due to lag between
 * Customer.io's Track-API write path and App-API read path — confirmed
 * via the debug-summary endpoint on 2026-05-25, ~7 records dropped per
 * dashboard load including 4 freshly-created variant test signups), we
 * fall back to a minimal record built from just the email so the signup
 * still shows up on the dashboard. The next dashboard load will pick up
 * the full attributes once they propagate.
 *
 * Without the fallback, freshly-created records silently disappear from
 * the dashboard for ~5-15 minutes after submission, which was the
 * symptom Cole reported.
 */
/**
 * Inner: actually fetch and parse a customer's attributes. Throws if the
 * CIO App API returns non-OK. Pulled out of getCustomerByCioId so the
 * retry loop can call it twice without duplicating the parse logic.
 */
async function fetchCustomerAttributes(
  cioId: string
): Promise<WaitlistPerson> {
  const resp = await cioFetch<CustomerAttributesResponse>(
    `/v1/api/customers/${encodeURIComponent(cioId)}/attributes?id_type=cio_id`
  );
  const attrs = resp.customer?.attributes || {};
  const ts = resp.customer?.timestamps || {};

  // Prefer the ISO string we set ourselves; fall back to the API's
  // last-modified timestamp of the waitlist_signed_up_at attribute.
  const signedUpAt =
    attrString(attrs, "waitlist_signed_up_at") ||
    fromTimestampSeconds(ts.waitlist_signed_up_at) ||
    fromTimestampSeconds(ts.first_name); // any signal of identify time

  // CIO stores booleans as the literal strings "true"/"false".
  const internalRaw = attrString(attrs, "internal");
  const internal = internalRaw === "true";

  const firstName = attrString(attrs, "first_name");
  const lastName = attrString(attrs, "last_name");
  const utmMedium = attrString(attrs, "utm_medium");
  const fbclidPresent = !!attrString(attrs, "fbclid");
  const storedTraffic = attrString(attrs, "traffic_type");

  // Resolution order:
  //   1. Manual name-based override (NAME_TRAFFIC_OVERRIDES above)
  //   2. Stored CIO attribute (set by /api/cio-track and the backfill)
  //   3. Computed from utm_medium + fbclid (the original on-the-fly classifier)
  const trafficType: "paid" | "organic" =
    nameTrafficOverride(firstName, lastName) ||
    (storedTraffic === "paid" || storedTraffic === "organic"
      ? storedTraffic
      : classifyCioTraffic({ utmMedium, fbclidPresent }));

  const variant = attrString(attrs, "variant") || "control";

  return {
    cioId,
    email:
      resp.customer.identifiers?.email ||
      attrString(attrs, "email") ||
      "(unknown)",
    firstName,
    lastName,
    source: attrString(attrs, "waitlist_source"),
    signedUpAt,
    utmSource: attrString(attrs, "utm_source"),
    utmMedium,
    utmCampaign: attrString(attrs, "utm_campaign"),
    utmTerm: attrString(attrs, "utm_term"),
    utmContent: attrString(attrs, "utm_content"),
    referredBy: attrString(attrs, "referred_by"),
    fbclidPresent,
    trafficType,
    variant,
    internal,
  };
}

export async function getCustomerByCioId(
  cioId: string,
  fallbackEmail?: string
): Promise<WaitlistPerson | null> {
  const now = Date.now();
  const cached = HYDRATION_CACHE.get(cioId);

  // Fast path: fresh cache entry. Waitlist records are write-once, so
  // a cached entry is identical to what we'd refetch — no API call
  // needed. This is what makes the dashboard stable across loads:
  // once we've successfully hydrated a record once, every subsequent
  // load serves the cached copy.
  if (cached && cacheIsFresh(cached, now)) {
    HYDRATION_STATS.cacheHits++;
    return cached.person;
  }

  // Cache miss or expired. Try a fresh fetch with one retry — CIO's
  // App API is observably flaky and a single retry catches most
  // transient blips.
  let lastError: unknown;
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const fresh = await fetchCustomerAttributes(cioId);
      HYDRATION_CACHE.set(cioId, { person: fresh, cachedAt: now });
      if (attempt === 0) HYDRATION_STATS.freshFetched++;
      else HYDRATION_STATS.retrySucceeded++;
      return fresh;
    } catch (err) {
      lastError = err;
      if (attempt === 0) {
        await new Promise((r) => setTimeout(r, 200));
      }
    }
  }

  // Fresh fetch failed. If we have a stale cache entry, serve it —
  // last-known-good data beats a "—" placeholder by a mile. The
  // record's data doesn't change, so a stale copy is still correct
  // (it just hasn't been re-verified recently).
  if (cached) {
    HYDRATION_STATS.cacheStaleServed++;
    console.warn(
      `[cio] hydrate failed for ${cioId} after retry; serving stale cache (age ${
        Math.round((now - cached.cachedAt) / 1000)
      }s)`
    );
    return cached.person;
  }

  // No cache, no fresh fetch. This is a brand-new record that's
  // never successfully hydrated. Last resort: partial fallback if
  // we have the email; otherwise drop it.
  console.warn(
    `[cio] hydrate failed for ${cioId} after retry, no cache: ${
      lastError instanceof Error ? lastError.message : String(lastError)
    }${fallbackEmail ? ` — using partial fallback for ${fallbackEmail}` : ""}`
  );

  if (!fallbackEmail) return null;
  HYDRATION_STATS.partialFallbacks++;

  {
    const internal = isInternalEmail(fallbackEmail);
    return {
      cioId,
      email: fallbackEmail,
      // No first/last name or UTMs available in the fallback path.
      // The dashboard filters partial records out of Recent Signups
      // (via the .partial flag below) so the "—" rendering doesn't
      // pollute the visible feed.
      firstName: undefined,
      lastName: undefined,
      source: undefined,
      // signedUpAt stays as "now" so the record still falls within
      // today's daily bucket (keeps cioSignupsByRange consistent with
      // cioTotal). The .partial flag below keeps it out of the
      // Recent Signups visual list so the placeholder timestamp
      // doesn't bubble fake "3s ago" rows to the top.
      signedUpAt: new Date().toISOString(),
      utmSource: undefined,
      utmMedium: undefined,
      utmCampaign: undefined,
      utmTerm: undefined,
      utmContent: undefined,
      referredBy: undefined,
      fbclidPresent: false,
      // Safe defaults; replaced by real values on next successful
      // hydration. The brief misattribution to "control" + "organic"
      // is acceptable because partial records are excluded from the
      // dashboard's variant/traffic-specific cells anyway.
      trafficType: "organic",
      variant: "control",
      internal,
      partial: true,
    };
  }
}

/**
 * Total waitlist count + the N most recent signups, hydrated with attributes.
 *
 * Strategy: page through the search endpoint to collect all cio_ids, then
 * fan-out attribute fetches in parallel. Fine for current waitlist sizes;
 * at >2k people we'd switch to a CIO segment with a server-sorted slice.
 */
export async function getWaitlistSummary(
  recentLimit: number = 20
): Promise<WaitlistSummary> {
  // Collect full identifiers (cio_id + email) so that if attribute
  // hydration fails for a freshly-created record we can still build a
  // minimal WaitlistPerson from the email rather than dropping it.
  //
  // Deduplicates by cio_id as a defense against CIO search pagination
  // bugs: if the server ever returns the same page twice (cursor not
  // advancing) we don't inflate the total. Observed on 2026-05-30 when
  // dashboard showed 2,000 signups against CIO's actual 148 — exactly
  // 20 pages × 100 = our pagination cap, meaning we looped on the same
  // page 20 times until breaking.
  const seenCioIds = new Set<string>();
  const allIdentifiers: SearchIdentifier[] = [];
  let cursor: string | undefined;

  for (let page = 0; page < 20; page++) {
    const resp = await searchWaitlistPeople(100, cursor);
    let newOnThisPage = 0;
    for (const ident of resp.identifiers || []) {
      if (ident.cio_id && !seenCioIds.has(ident.cio_id)) {
        seenCioIds.add(ident.cio_id);
        allIdentifiers.push(ident);
        newOnThisPage++;
      }
    }
    // Loop-detection: if a page brings nothing new, CIO is either out
    // of results or stuck on the same page. Either way, stop here.
    if (newOnThisPage === 0) {
      if (page > 0) {
        console.warn(
          `[cio] search pagination yielded no new records on page ${page} (${
            (resp.identifiers || []).length
          } returned, all duplicates) — breaking to avoid infinite loop`
        );
      }
      break;
    }
    if (!resp.next) break;
    cursor = resp.next;
  }

  // Hydrate. For now, hydrate everyone; sort by signedUpAt desc; slice.
  // Limit concurrency to avoid hammering CIO's API on big waitlists.
  // Pass each identifier's email as fallback so hydrate failures (e.g.
  // Track-API → App-API propagation lag for very recent signups) still
  // yield a minimal record with internal/external correctly classified.
  const concurrency = 10;
  const hydrated: (WaitlistPerson | null)[] = [];
  for (let i = 0; i < allIdentifiers.length; i += concurrency) {
    const batch = allIdentifiers.slice(i, i + concurrency);
    const results = await Promise.all(
      batch.map((ident) => getCustomerByCioId(ident.cio_id, ident.email))
    );
    hydrated.push(...results);
  }

  // Exclude internal team signups (e.g. @bowskyventures.com) from every
  // count the dashboard surfaces — total, recent list, daily chart. They
  // still exist in CIO so the team can test the email flow, just not on
  // the metrics dashboard.
  const all = hydrated.filter((p): p is WaitlistPerson => p !== null);
  const people = all.filter((p) => !p.internal);
  people.sort((a, b) => (b.signedUpAt || "").localeCompare(a.signedUpAt || ""));

  const total = people.length;

  // Group by UTC date for the daily chart, and again split by traffic type
  // so the dashboard's paid/organic/all filter has pre-aggregated data.
  // Additionally bucket by variant so the dashboard's Variant filter can
  // surface per-variant signup counts and conversion math.
  const dailySignups: Record<string, number> = {};
  const dailySignupsByTraffic = {
    paid: {} as Record<string, number>,
    organic: {} as Record<string, number>,
  };
  const dailySignupsByVariant: Record<string, Record<string, number>> = {};
  const totalByVariant: Record<string, number> = {};
  let paidTotal = 0;
  let organicTotal = 0;

  for (const p of people) {
    if (p.trafficType === "paid") paidTotal++;
    else organicTotal++;
    totalByVariant[p.variant] = (totalByVariant[p.variant] || 0) + 1;

    if (!p.signedUpAt) continue;
    const dateStr = p.signedUpAt.slice(0, 10); // "2026-05-21"
    dailySignups[dateStr] = (dailySignups[dateStr] || 0) + 1;
    const trafficMap = dailySignupsByTraffic[p.trafficType];
    trafficMap[dateStr] = (trafficMap[dateStr] || 0) + 1;
    if (!dailySignupsByVariant[p.variant]) dailySignupsByVariant[p.variant] = {};
    const variantMap = dailySignupsByVariant[p.variant];
    variantMap[dateStr] = (variantMap[dateStr] || 0) + 1;
  }

  // Recent Signups visual list excludes partial records (those rescued
  // by the fallback because direct hydration failed). Their data is
  // placeholder ("—" name, "direct" source, "now" timestamp), so they'd
  // create the appearance of fake fresh signups bubbling to the top and
  // displacing real ones every page load. They still contribute to
  // `total` and to today's `dailySignups` bucket, so cioTotal and
  // cioSignupsByRange stay accurate — only the visible feed is purified.
  const recent = people.filter((p) => !p.partial).slice(0, recentLimit);

  return {
    total,
    recent,
    dailySignups,
    dailySignupsByTraffic,
    totalByTraffic: {
      paid: paidTotal,
      organic: organicTotal,
      all: total,
    },
    dailySignupsByVariant,
    totalByVariant,
  };
}
