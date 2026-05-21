/**
 * Customer.io App API client.
 *
 * Reads waitlist signups for the team dashboard.
 *
 * Required env:
 *   CIO_APP_API_KEY — App API token (Bearer). Server-only, marked sensitive.
 *   CIO_REGION      — "us" (default) or "eu". Determines the API host.
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
    // Cache nothing on the fetch layer; dashboard page handles revalidation.
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
  id: string; // customer id (our email)
  email: string;
  firstName?: string;
  lastName?: string;
  source?: string;
  signedUpAt?: string; // ISO
  createdAt?: string; // ISO from CIO
}

export interface WaitlistSummary {
  total: number;
  recent: WaitlistPerson[];
}

// -----------------------------------------------------------------------------
// Queries

interface SearchResponse {
  identifiers: Array<{
    id?: string;
    cio_id?: string;
    email?: string;
  }>;
  next?: string | null;
}

interface CustomerResponse {
  customer: {
    id?: string;
    cio_id?: string;
    identifiers?: { id?: string; email?: string };
    attributes?: Record<string, unknown>;
    timestamps?: { created_at?: number; updated_at?: number };
  };
}

function toIso(seconds: number | undefined): string | undefined {
  if (!seconds || !Number.isFinite(seconds)) return undefined;
  return new Date(seconds * 1000).toISOString();
}

function attrString(
  attrs: Record<string, unknown> | undefined,
  key: string
): string | undefined {
  if (!attrs) return undefined;
  const v = attrs[key];
  if (typeof v === "string" && v.length > 0) return v;
  return undefined;
}

/**
 * Search People with the `waitlist` attribute set to true.
 *
 * Uses Customer.io's Customer Search endpoint:
 *   POST /v1/api/customers/search
 *
 * Returns lightweight identifiers; we hydrate details for the most recent
 * N people separately to keep the call small.
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
  };

  const qs = new URLSearchParams({ limit: String(limit) });
  if (start) qs.set("start", start);

  return cioFetch<SearchResponse>(
    `/v1/api/customers?${qs.toString()}`,
    {
      method: "POST",
      body: JSON.stringify(body),
    }
  );
}

/**
 * Fetch the full attribute set for one customer by id (email).
 */
export async function getCustomer(id: string): Promise<WaitlistPerson | null> {
  const encoded = encodeURIComponent(id);
  try {
    const resp = await cioFetch<CustomerResponse>(
      `/v1/api/customers/${encoded}/attributes`
    );
    const attrs = resp.customer?.attributes;
    const created = resp.customer?.timestamps?.created_at;
    return {
      id: resp.customer?.identifiers?.id || id,
      email: resp.customer?.identifiers?.email || id,
      firstName: attrString(attrs, "first_name"),
      lastName: attrString(attrs, "last_name"),
      source: attrString(attrs, "waitlist_source"),
      signedUpAt: attrString(attrs, "waitlist_signed_up_at") || toIso(created),
      createdAt: toIso(created),
    };
  } catch {
    return null;
  }
}

/**
 * Total waitlist count + the N most recent signups, hydrated with details.
 */
export async function getWaitlistSummary(
  recentLimit: number = 20
): Promise<WaitlistSummary> {
  // 1. Pull the full list of waitlist identifiers (paginated).
  const allIds: string[] = [];
  let cursor: string | undefined;
  for (let page = 0; page < 20; page++) {
    const resp = await searchWaitlistPeople(100, cursor);
    for (const ident of resp.identifiers || []) {
      if (ident.email) allIds.push(ident.email);
      else if (ident.id) allIds.push(ident.id);
    }
    if (!resp.next) break;
    cursor = resp.next;
  }

  const total = allIds.length;

  // 2. Hydrate the most recent N (by created_at). To know which are "most
  //    recent" we need created_at — that requires fetching attributes. To
  //    avoid hydrating everyone, we hydrate ALL on the first run (we expect
  //    early-stage waitlist sizes < 2000), sort by createdAt desc, slice.
  //    Once volumes grow, we'll add server-side sorting via segments.
  const hydrated = await Promise.all(allIds.map((id) => getCustomer(id)));
  const people = hydrated.filter((p): p is WaitlistPerson => p !== null);

  people.sort((a, b) => {
    const aT = a.createdAt || a.signedUpAt || "";
    const bT = b.createdAt || b.signedUpAt || "";
    return bT.localeCompare(aT);
  });

  return {
    total,
    recent: people.slice(0, recentLimit),
  };
}
