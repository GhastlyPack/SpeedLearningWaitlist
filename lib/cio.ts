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
export async function getCustomerByCioId(
  cioId: string,
  fallbackEmail?: string
): Promise<WaitlistPerson | null> {
  try {
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
    // The override wins so we can correct historical mis-classifications
    // without needing to round-trip a write to CIO. The stored attribute
    // wins next so manual edits in CIO's admin UI propagate to the dashboard.
    const trafficType: "paid" | "organic" =
      nameTrafficOverride(firstName, lastName) ||
      (storedTraffic === "paid" || storedTraffic === "organic"
        ? storedTraffic
        : classifyCioTraffic({ utmMedium, fbclidPresent }));

    // Variant defaults to "control" for the root lander and for older
    // records that pre-date variant tracking. The dashboard's Variant
    // filter treats undefined as "control" so historic data still buckets.
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
  } catch (err) {
    // Hydration failed. Most common cause: Track-API → App-API
    // propagation lag for very recent signups (App-API returns 404 on
    // /attributes for cio_ids that ARE searchable in /customers).
    //
    // Log for visibility, then fall back to a minimal record if we
    // have the email — better to show the signup with default
    // metadata than to drop it from the dashboard entirely.
    console.warn(
      `[cio] hydrate failed for ${cioId}: ${
        err instanceof Error ? err.message : String(err)
      }${fallbackEmail ? ` — using fallback record for ${fallbackEmail}` : ""}`
    );

    if (!fallbackEmail) return null;

    const internal = isInternalEmail(fallbackEmail);
    return {
      cioId,
      email: fallbackEmail,
      // First/last name + UTMs come from attributes — unavailable in
      // the fallback path. Dashboard cells render "—" for these,
      // which is fine for the brief window before the next load
      // hydrates fully.
      firstName: undefined,
      lastName: undefined,
      source: undefined,
      // Use "now" as a placeholder so the record appears at the top
      // of Recent Signups. When attributes propagate, the real
      // waitlist_signed_up_at replaces this.
      signedUpAt: new Date().toISOString(),
      utmSource: undefined,
      utmMedium: undefined,
      utmCampaign: undefined,
      utmTerm: undefined,
      utmContent: undefined,
      referredBy: undefined,
      fbclidPresent: false,
      // Safe defaults; real values appear on next refresh.
      trafficType: "organic",
      variant: "control",
      internal,
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
  const allIdentifiers: SearchIdentifier[] = [];
  let cursor: string | undefined;

  for (let page = 0; page < 20; page++) {
    const resp = await searchWaitlistPeople(100, cursor);
    for (const ident of resp.identifiers || []) {
      if (ident.cio_id) allIdentifiers.push(ident);
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

  return {
    total,
    recent: people.slice(0, recentLimit),
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
