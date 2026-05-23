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

/**
 * Pick the single best lead count from Meta's `actions` array.
 *
 * Meta returns the SAME underlying Lead conversion categorized under
 * multiple action_type names. For our pixel + CAPI setup these usually
 * include both "lead" (the aggregate) and "offsite_conversion.fb_pixel_lead"
 * (the categorized form) — they're the same conversions, not separate
 * counts. Summing across them double-counts (2× per signup).
 *
 * Strategy: walk a priority list and return the first match. Never sum.
 *
 *   "lead"                              — deduplicated aggregate
 *   "offsite_conversion.fb_pixel_lead"  — pixel/CAPI Lead (post-dedup)
 *   "onsite_conversion.lead_grouped"    — native lead forms (we don't use these)
 *
 * We log everything lead-shaped to Vercel logs so the next discrepancy
 * is easy to diagnose from the raw API response.
 */
function leadsFromActions(actions?: ActionEntry[]): number {
  if (!actions || actions.length === 0) return 0;

  const leadShaped = actions.filter(
    (a) =>
      a.action_type === "lead" ||
      a.action_type === "onsite_web_lead" ||
      a.action_type === "offsite_conversion.fb_pixel_lead" ||
      a.action_type === "onsite_conversion.lead_grouped" ||
      a.action_type.endsWith(".lead") ||
      a.action_type.endsWith("_lead")
  );
  if (leadShaped.length > 0) {
    console.log("[meta] lead actions", JSON.stringify(leadShaped));
  }

  const priority = [
    "lead",
    "onsite_web_lead",                    // Meta's newer name for website leads — this is what our account actually returns
    "offsite_conversion.fb_pixel_lead",
    "onsite_conversion.lead_grouped",
  ];
  for (const type of priority) {
    const match = actions.find((a) => a.action_type === type);
    if (match) return n(match.value);
  }
  // Last-resort fallback: any other ".lead"-suffix type, but only one.
  const fallback = actions.find(
    (a) => a.action_type.endsWith(".lead") || a.action_type.endsWith("_lead")
  );
  return fallback ? n(fallback.value) : 0;
}

/** Same priority rule for cost-per-lead — never sum/average across types. */
function cpaFromActions(costs?: ActionEntry[]): number | null {
  if (!costs || costs.length === 0) return null;
  const priority = [
    "lead",
    "onsite_web_lead",                    // Meta's newer name for website leads — this is what our account actually returns
    "offsite_conversion.fb_pixel_lead",
    "onsite_conversion.lead_grouped",
  ];
  for (const type of priority) {
    const match = costs.find((c) => c.action_type === type);
    if (match) return n(match.value);
  }
  const fallback = costs.find(
    (c) => c.action_type.endsWith(".lead") || c.action_type.endsWith("_lead")
  );
  return fallback ? n(fallback.value) : null;
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
 * Range presets the dashboard uses. Mapped to either an explicit
 * time_range (since/until ISO dates) or date_preset=maximum.
 *
 *   "24h" — yesterday + today (rolling-ish 24 hours). Meta's API has a
 *           several-hour delay on TODAY's data; expanding to yesterday
 *           guarantees the panel is always populated.
 *   "7d"  — last 7 calendar days, today inclusive.
 *   "30d" — last 30 calendar days, today inclusive.
 *   "all" — lifetime via date_preset=maximum.
 */
export type RangePreset = "24h" | "7d" | "30d" | "all";

function timeRangeParam(days: number): string {
  const today = new Date();
  const until = today.toISOString().slice(0, 10); // YYYY-MM-DD (UTC)
  const sinceDate = new Date(today);
  sinceDate.setUTCDate(today.getUTCDate() - (days - 1));
  const since = sinceDate.toISOString().slice(0, 10);
  return JSON.stringify({ since, until });
}

function paramsForRange(preset: RangePreset): Record<string, string> {
  switch (preset) {
    case "24h":
      return { time_range: timeRangeParam(2) };
    case "7d":
      return { time_range: timeRangeParam(7) };
    case "30d":
      return { time_range: timeRangeParam(30) };
    case "all":
      return { date_preset: "maximum" };
  }
}

/** Account-level insights for a range preset. */
export async function getAccountInsights(
  preset: RangePreset = "30d"
): Promise<MetaInsight> {
  interface Resp {
    data: InsightRow[];
  }
  const resp = await metaFetch<Resp>(`/${getAccountId()}/insights`, {
    fields:
      "spend,impressions,clicks,ctr,cpc,cpm,actions,cost_per_action_type",
    ...paramsForRange(preset),
    level: "account",
  });
  return rowToInsight(resp.data?.[0]);
}

/**
 * Top campaigns over a range preset, sorted by leads desc then spend desc.
 *
 * Uses /insights with level=campaign — single call, returns each campaign
 * with its insights merged into the same row. Doesn't include campaign
 * status (insights endpoint doesn't expose it); we omit status from the
 * table UI rather than make a separate /campaigns call for it.
 */
export async function getTopCampaigns(
  preset: RangePreset = "30d",
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
    ...paramsForRange(preset),
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

/** Top ads (creatives) over a range preset. */
export async function getTopAds(
  preset: RangePreset = "30d",
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
    ...paramsForRange(preset),
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
