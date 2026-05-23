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

/**
 * Build an explicit time_range JSON parameter that ALWAYS includes today.
 * Meta's `date_preset=last_7d`/`last_30d` semantics shift depending on the
 * account; on some accounts today is excluded, which silently zeros out
 * fresh-campaign data. Explicit dates avoid that ambiguity.
 */
function timeRangeParam(days: number): string {
  const today = new Date();
  const until = today.toISOString().slice(0, 10); // YYYY-MM-DD (UTC)
  const sinceDate = new Date(today);
  sinceDate.setUTCDate(today.getUTCDate() - (days - 1));
  const since = sinceDate.toISOString().slice(0, 10);
  return JSON.stringify({ since, until });
}

/** Account-level insights for the last N days, today inclusive. */
export async function getAccountInsights(
  days: number = 30
): Promise<MetaInsight> {
  interface Resp {
    data: InsightRow[];
  }
  const resp = await metaFetch<Resp>(`/${getAccountId()}/insights`, {
    fields:
      "spend,impressions,clicks,ctr,cpc,cpm,actions,cost_per_action_type",
    time_range: timeRangeParam(days),
    level: "account",
  });
  return rowToInsight(resp.data?.[0]);
}

/**
 * Top campaigns over the last N days, sorted by leads desc then spend desc.
 *
 * Uses /insights with level=campaign — single call, returns each campaign
 * with its insights merged into the same row. Doesn't include campaign
 * status (insights endpoint doesn't expose it); we omit status from the
 * table UI rather than make a separate /campaigns call for it.
 */
export async function getTopCampaigns(
  days: number = 30,
  limit: number = 5
): Promise<MetaCampaign[]> {
  interface CampaignInsightRow extends InsightRow {
    campaign_id?: string;
    campaign_name?: string;
  }
  interface Resp {
    data: CampaignInsightRow[];
  }
  const resp = await metaFetch<Resp>(`/${getAccountId()}/insights`, {
    fields:
      "campaign_id,campaign_name,spend,impressions,clicks,ctr,actions,cost_per_action_type",
    time_range: timeRangeParam(days),
    level: "campaign",
    limit: "100",
  });

  const campaigns: MetaCampaign[] = (resp.data || []).map((row) => {
    const ins = rowToInsight(row);
    return {
      id: row.campaign_id || "",
      name: row.campaign_name || "(unnamed)",
      status: "",
      spend: ins.spend,
      impressions: ins.impressions,
      clicks: ins.clicks,
      ctr: ins.ctr,
      leads: ins.leads,
      costPerLead: ins.costPerLead,
    };
  });

  campaigns.sort((a, b) => b.leads - a.leads || b.spend - a.spend);
  return campaigns
    .filter((c) => c.spend > 0 || c.impressions > 0)
    .slice(0, limit);
}

/** Top ads (creatives) over the last N days. */
export async function getTopAds(
  days: number = 30,
  limit: number = 5
): Promise<MetaAd[]> {
  interface AdInsightRow extends InsightRow {
    ad_id?: string;
    ad_name?: string;
  }
  interface Resp {
    data: AdInsightRow[];
  }
  const resp = await metaFetch<Resp>(`/${getAccountId()}/insights`, {
    fields:
      "ad_id,ad_name,spend,impressions,clicks,ctr,actions,cost_per_action_type",
    time_range: timeRangeParam(days),
    level: "ad",
    limit: "100",
  });

  const ads: MetaAd[] = (resp.data || []).map((row) => {
    const ins = rowToInsight(row);
    return {
      id: row.ad_id || "",
      name: row.ad_name || "(unnamed)",
      status: "",
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
