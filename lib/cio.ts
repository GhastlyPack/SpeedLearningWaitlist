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
 */
export async function getCustomerByCioId(
  cioId: string
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

    const utmMedium = attrString(attrs, "utm_medium");
    const fbclidPresent = !!attrString(attrs, "fbclid");
    const trafficType = classifyCioTraffic({ utmMedium, fbclidPresent });

    return {
      cioId,
      email:
        resp.customer.identifiers?.email ||
        attrString(attrs, "email") ||
        "(unknown)",
      firstName: attrString(attrs, "first_name"),
      lastName: attrString(attrs, "last_name"),
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
      internal,
    };
  } catch {
    return null;
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
  const allCioIds: string[] = [];
  let cursor: string | undefined;

  for (let page = 0; page < 20; page++) {
    const resp = await searchWaitlistPeople(100, cursor);
    for (const ident of resp.identifiers || []) {
      if (ident.cio_id) allCioIds.push(ident.cio_id);
    }
    if (!resp.next) break;
    cursor = resp.next;
  }

  // Hydrate. For now, hydrate everyone; sort by signedUpAt desc; slice.
  // Limit concurrency to avoid hammering CIO's API on big waitlists.
  const concurrency = 10;
  const hydrated: (WaitlistPerson | null)[] = [];
  for (let i = 0; i < allCioIds.length; i += concurrency) {
    const batch = allCioIds.slice(i, i + concurrency);
    const results = await Promise.all(
      batch.map((cid) => getCustomerByCioId(cid))
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
  const dailySignups: Record<string, number> = {};
  const dailySignupsByTraffic = {
    paid: {} as Record<string, number>,
    organic: {} as Record<string, number>,
  };
  let paidTotal = 0;
  let organicTotal = 0;

  for (const p of people) {
    if (p.trafficType === "paid") paidTotal++;
    else organicTotal++;

    if (!p.signedUpAt) continue;
    const dateStr = p.signedUpAt.slice(0, 10); // "2026-05-21"
    dailySignups[dateStr] = (dailySignups[dateStr] || 0) + 1;
    const trafficMap = dailySignupsByTraffic[p.trafficType];
    trafficMap[dateStr] = (trafficMap[dateStr] || 0) + 1;
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
  };
}
