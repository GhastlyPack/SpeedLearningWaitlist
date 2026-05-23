/**
 * Meta Marketing API client.
 *
 * Server-side only. Reads ad performance data from the Speed Learning2.0
 * ad account for the internal dashboard.
 *
 * Required env:
 *   META_MARKETING_TOKEN — long-lived System User access token with
 *                          ads_read + business_management scopes.
 *   META_AD_ACCOUNT_ID   — ad account ID, with or without "act_" prefix.
 *                          Normalized to "act_X" internally.
 */

const TOKEN = process.env.META_MARKETING_TOKEN;
const ACCOUNT_ID_RAW = process.env.META_AD_ACCOUNT_ID;
const API_VERSION = "v23.0";
const BASE = `https://graph.facebook.com/${API_VERSION}`;

function getAccountId(): string {
  if (!ACCOUNT_ID_RAW) {
    throw new Error("META_AD_ACCOUNT_ID env var is not set.");
  }
  return ACCOUNT_ID_RAW.startsWith("act_")
    ? ACCOUNT_ID_RAW
    : `act_${ACCOUNT_ID_RAW}`;
}

async function metaFetch<T>(
  path: string,
  params?: Record<string, string>
): Promise<T> {
  if (!TOKEN) {
    throw new Error("META_MARKETING_TOKEN env var is not set.");
  }
  const url = new URL(`${BASE}${path}`);
  if (params) {
    for (const [k, v] of Object.entries(params)) {
      url.searchParams.set(k, v);
    }
  }
  url.searchParams.set("access_token", TOKEN);

  // Build a redacted URL for logs so we don't leak the token.
  const safeUrl = url.toString().replace(/access_token=[^&]+/, "access_token=***");
  const accountId = ACCOUNT_ID_RAW || "(unset)";

  const resp = await fetch(url.toString(), { cache: "no-store" });
  const bodyText = await resp.text();

  if (!resp.ok) {
    console.error(
      "[meta] error",
      JSON.stringify({
        status: resp.status,
        url: safeUrl,
        account_env: accountId,
        body: bodyText.slice(0, 500),
      })
    );
    throw new Error(
      `Meta API ${resp.status} for ${path}: ${bodyText.slice(0, 300)}`
    );
  }

  // Log success too — first 600 chars of the body so we can see whether
  // Meta is returning empty data, all zeros, or actual rows.
  console.log(
    "[meta] ok",
    JSON.stringify({
      url: safeUrl,
      account_env: accountId,
      body_preview: bodyText.slice(0, 600),
    })
  );

  try {
    return JSON.parse(bodyText) as T;
  } catch (err) {
    throw new Error(
      `Meta API returned non-JSON for ${path}: ${
        err instanceof Error ? err.message : String(err)
      }`
    );
  }
}

// -----------------------------------------------------------------------------
// Types

export interface MetaInsight {
  spend: number;
  impressions: number;
  clicks: number;
  ctr: number; // percent
  cpc: number; // dollars
  cpm: number; // dollars
  leads: number;
  costPerLead: number | null;
}

export interface MetaCampaign {
  id: string;
  name: string;
  status: string;
  spend: number;
  impressions: number;
  clicks: number;
  ctr: number;
  leads: number;
  costPerLead: number | null;
}

export interface MetaAd {
  id: string;
  name: string;
  status: string;
  spend: number;
  impressions: number;
  clicks: number;
  ctr: number;
  leads: number;
  costPerLead: number | null;
}

// -----------------------------------------------------------------------------
// Internal helpers

function n(v: unknown): number {
  if (v == null) return 0;
  const x = typeof v === "number" ? v : Number(v);
  return Number.isFinite(x) ? x : 0;
}

interface ActionEntry {
  action_type: string;
  value: string | number;
}

/** Sum leads across all action_types whose name contains "lead". Meta
 *  reports leads under several keys depending on event source: "lead",
 *  "offsite_conversion.fb_pixel_lead", "onsite_conversion.lead_grouped". */
function leadsFromActions(actions?: ActionEntry[]): number {
  if (!actions) return 0;
  // To avoid double-counting, prefer "lead" if present; otherwise sum
  // the most specific pixel/onsite lead actions.
  const totalLead = actions.find((a) => a.action_type === "lead");
  if (totalLead) return n(totalLead.value);

  let total = 0;
  for (const a of actions) {
    if (
      a.action_type.endsWith(".lead") ||
      a.action_type.endsWith("_lead") ||
      a.action_type === "offsite_conversion.fb_pixel_lead" ||
      a.action_type === "onsite_conversion.lead_grouped"
    ) {
      total += n(a.value);
    }
  }
  return total;
}

function cpaFromActions(costs?: ActionEntry[]): number | null {
  if (!costs) return null;
  for (const a of costs) {
    if (a.action_type === "lead") return n(a.value);
  }
  for (const a of costs) {
    if (
      a.action_type.endsWith(".lead") ||
      a.action_type.endsWith("_lead")
    ) {
      return n(a.value);
    }
  }
  return null;
}

interface InsightRow {
  spend?: string;
  impressions?: string;
  clicks?: string;
  ctr?: string;
  cpc?: string;
  cpm?: string;
  actions?: ActionEntry[];
  cost_per_action_type?: ActionEntry[];
}

function rowToInsight(row?: InsightRow): MetaInsight {
  return {
    spend: n(row?.spend),
    impressions: n(row?.impressions),
    clicks: n(row?.clicks),
    ctr: n(row?.ctr),
    cpc: n(row?.cpc),
    cpm: n(row?.cpm),
    leads: leadsFromActions(row?.actions),
    costPerLead: cpaFromActions(row?.cost_per_action_type),
  };
}

// -----------------------------------------------------------------------------
// Queries

/** Account-level insights for a date preset. */
export async function getAccountInsights(
  datePreset: string = "last_30d"
): Promise<MetaInsight> {
  interface Resp {
    data: InsightRow[];
  }
  const resp = await metaFetch<Resp>(`/${getAccountId()}/insights`, {
    fields:
      "spend,impressions,clicks,ctr,cpc,cpm,actions,cost_per_action_type",
    date_preset: datePreset,
    level: "account",
  });
  return rowToInsight(resp.data?.[0]);
}

/** Top campaigns over a date preset, sorted by leads desc then spend desc. */
export async function getTopCampaigns(
  datePreset: string = "last_30d",
  limit: number = 5
): Promise<MetaCampaign[]> {
  interface Resp {
    data: Array<{
      id: string;
      name: string;
      status: string;
      insights?: { data?: InsightRow[] };
    }>;
  }
  const resp = await metaFetch<Resp>(`/${getAccountId()}/campaigns`, {
    fields: `id,name,status,insights.date_preset(${datePreset}){spend,impressions,clicks,ctr,actions,cost_per_action_type}`,
    limit: "100",
  });

  const campaigns: MetaCampaign[] = (resp.data || []).map((c) => {
    const ins = rowToInsight(c.insights?.data?.[0]);
    return {
      id: c.id,
      name: c.name,
      status: c.status,
      spend: ins.spend,
      impressions: ins.impressions,
      clicks: ins.clicks,
      ctr: ins.ctr,
      leads: ins.leads,
      costPerLead: ins.costPerLead,
    };
  });

  campaigns.sort((a, b) => b.leads - a.leads || b.spend - a.spend);
  // Drop campaigns with zero spend AND zero impressions — not active enough
  // to be meaningful in a "top" view.
  return campaigns
    .filter((c) => c.spend > 0 || c.impressions > 0)
    .slice(0, limit);
}

/** Top ads (creatives) over a date preset, sorted by leads desc then spend desc. */
export async function getTopAds(
  datePreset: string = "last_30d",
  limit: number = 5
): Promise<MetaAd[]> {
  interface Resp {
    data: Array<{
      id: string;
      name: string;
      status: string;
      insights?: { data?: InsightRow[] };
    }>;
  }
  const resp = await metaFetch<Resp>(`/${getAccountId()}/ads`, {
    fields: `id,name,status,insights.date_preset(${datePreset}){spend,impressions,clicks,ctr,actions,cost_per_action_type}`,
    limit: "100",
  });

  const ads: MetaAd[] = (resp.data || []).map((a) => {
    const ins = rowToInsight(a.insights?.data?.[0]);
    return {
      id: a.id,
      name: a.name,
      status: a.status,
      spend: ins.spend,
      impressions: ins.impressions,
      clicks: ins.clicks,
      ctr: ins.ctr,
      leads: ins.leads,
      costPerLead: ins.costPerLead,
    };
  });

  ads.sort((a, b) => b.leads - a.leads || b.spend - a.spend);
  return ads.filter((a) => a.spend > 0 || a.impressions > 0).slice(0, limit);
}
