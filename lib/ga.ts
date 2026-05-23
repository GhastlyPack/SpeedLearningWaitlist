/**
 * Google Analytics 4 Data API client.
 *
 * Credentials are loaded from GOOGLE_APPLICATION_CREDENTIALS_BASE64 (a base64
 * encoding of the service account JSON key file). The matching service account
 * email must be granted the Viewer role on the GA4 property.
 *
 * GA4 Property ID (numeric, not the G-XXXXXXX measurement ID) is read from
 * GA_PROPERTY_ID env var.
 */

import { BetaAnalyticsDataClient } from "@google-analytics/data";

let cachedClient: BetaAnalyticsDataClient | null = null;
let cachedProperty: string | null = null;

function getClient(): { client: BetaAnalyticsDataClient; property: string } {
  if (cachedClient && cachedProperty) {
    return { client: cachedClient, property: cachedProperty };
  }

  const b64 = process.env.GOOGLE_APPLICATION_CREDENTIALS_BASE64;
  const propertyId = process.env.GA_PROPERTY_ID;

  if (!b64) {
    throw new Error("GOOGLE_APPLICATION_CREDENTIALS_BASE64 env var is not set.");
  }
  if (!propertyId) {
    throw new Error("GA_PROPERTY_ID env var is not set.");
  }

  let credentials: Record<string, unknown>;
  try {
    credentials = JSON.parse(Buffer.from(b64, "base64").toString("utf8"));
  } catch (err) {
    throw new Error(
      "GOOGLE_APPLICATION_CREDENTIALS_BASE64 is not valid base64 JSON: " +
        (err instanceof Error ? err.message : String(err))
    );
  }

  cachedClient = new BetaAnalyticsDataClient({ credentials });
  cachedProperty = `properties/${propertyId}`;
  return { client: cachedClient, property: cachedProperty };
}

// -----------------------------------------------------------------------------
// Types

export interface HeroMetrics {
  pageViews: number;
  sessions: number;
  activeUsers: number;
  scrolls: number;
  formStarts: number;
  waitlistSignups: number;
}

export interface DailyTrendPoint {
  date: string; // YYYY-MM-DD
  sessions: number;
  signups: number;
}

export interface TrafficSource {
  source: string;
  medium: string;
  sessions: number;
}

export interface RealtimeSnapshot {
  activeUsers: number;
}

/**
 * Range presets driving the dashboard's top filter. Mirror the Meta side
 * so a "24h" toggle returns comparable windows across both data sources.
 *
 *   "24h" — yesterday + today (rolling-ish 24h, robust to GA timezone slop)
 *   "7d"  — last 7 calendar days, today inclusive
 *   "30d" — last 30 calendar days, today inclusive
 *   "all" — lifetime, using a sentinel start date well before the property
 *           was created
 */
export type GaRangePreset = "24h" | "7d" | "30d" | "all";

export function gaRangeBounds(preset: GaRangePreset): {
  startDate: string;
  endDate: string;
} {
  switch (preset) {
    case "24h":
      return { startDate: "yesterday", endDate: "today" };
    case "7d":
      return { startDate: "6daysAgo", endDate: "today" };
    case "30d":
      return { startDate: "29daysAgo", endDate: "today" };
    case "all":
      return { startDate: "2020-01-01", endDate: "today" };
  }
}

/**
 * Traffic-type filter. Cuts the dashboard into paid-ad-driven vs organic
 * visitors so we can see conversion behavior separately for each.
 *
 * "paid"    — ad clicks (Meta, Google Ads, display, etc.)
 * "organic" — everything else (direct, referral, organic search/social, share)
 * "all"     — no filter
 */
export type GaTrafficType = "paid" | "organic" | "all";

/**
 * Classify a GA4 default channel group as paid or organic. GA groups include:
 *   Paid Search, Paid Social, Paid Shopping, Paid Video, Display,
 *   Cross-network -> paid
 *   Direct, Organic Search, Organic Social, Referral, Email, etc. -> organic
 */
export function classifyGaChannelGroup(group: string): "paid" | "organic" {
  const g = (group || "").toLowerCase();
  if (
    g.startsWith("paid") ||
    g === "display" ||
    g === "cross-network"
  ) {
    return "paid";
  }
  return "organic";
}

// -----------------------------------------------------------------------------
// Helpers

function n(value: string | null | undefined): number {
  if (value == null) return 0;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function isoDateFromGaYmd(ymd: string): string {
  // GA returns dates like "20260521". Convert to "2026-05-21".
  if (ymd.length !== 8) return ymd;
  return `${ymd.slice(0, 4)}-${ymd.slice(4, 6)}-${ymd.slice(6, 8)}`;
}

// -----------------------------------------------------------------------------
// Queries

/**
 * Counts of key events over a date range.
 *
 * Returns totals for: pageViews, sessions, activeUsers, scrolls, formStarts,
 * waitlistSignups.
 */
function emptyHero(): HeroMetrics {
  return {
    pageViews: 0,
    sessions: 0,
    activeUsers: 0,
    scrolls: 0,
    formStarts: 0,
    waitlistSignups: 0,
  };
}

/**
 * Tiny helper: resolve a dimension's row position via its header name.
 * Used everywhere we parse multi-dimension GA responses — safer than
 * positional indexing because GA can reorder dimensions in the response
 * (and the implicit "dateRange" dimension is always tacked on at the end).
 */
function dimIdx(
  resp:
    | { dimensionHeaders?: Array<{ name?: string | null }> | null }
    | null
    | undefined,
  name: string
): number {
  const headers = resp?.dimensionHeaders ?? [];
  for (let i = 0; i < headers.length; i++) {
    if (headers[i]?.name === name) return i;
  }
  return -1;
}

/**
 * Hero metrics for one OR MORE range presets, bucketed by traffic type
 * (paid / organic / all).
 *
 * Bundles all requested ranges into a single GA call using the dateRanges
 * parameter — one query returns rows tagged with which range they belong
 * to via the implicit "dateRange" dimension. Each preset must have a `name`
 * that GA echoes back on the rows.
 *
 * Why bundle: the dashboard fetches all 4 ranges at once. Before bundling,
 * that was 16 concurrent GA queries (4 ranges × 4 internal sub-queries) and
 * blew past GA's 10-per-property concurrent quota. Now it's 4 queries
 * total regardless of how many presets are requested.
 *
 * Returns: Record<preset, Record<trafficType, HeroMetrics>>.
 */
export async function getHeroMetrics(
  presets: GaRangePreset[] | GaRangePreset = ["30d"]
): Promise<Record<GaRangePreset, Record<GaTrafficType, HeroMetrics>>> {
  const presetList: GaRangePreset[] = Array.isArray(presets) ? presets : [presets];
  const { client, property } = getClient();
  const dateRanges = presetList.map((p) => {
    const { startDate, endDate } = gaRangeBounds(p);
    return { name: p, startDate, endDate };
  });

  // Pre-seed the result so every requested preset has buckets — even if a
  // particular range has zero data and GA returns no rows for it.
  const result = {} as Record<GaRangePreset, Record<GaTrafficType, HeroMetrics>>;
  for (const p of presetList) {
    result[p] = { paid: emptyHero(), organic: emptyHero(), all: emptyHero() };
  }

  // Four parallel queries, each across all requested ranges:
  //  1. Segmented metrics (channel-group dim) — feeds paid/organic
  //  2. Segmented events (eventName + channel-group) — feeds paid/organic
  //  3. Unsegmented metrics — feeds the "all" bucket without activeUsers
  //     double-counting that segmented-by-channel queries suffer from
  //  4. Unsegmented events — feeds the "all" bucket's event counts
  const [metricsResp, eventsResp, allMetricsResp, allEventsResp] = await Promise.all([
    client.runReport({
      property,
      dateRanges,
      dimensions: [{ name: "sessionDefaultChannelGroup" }],
      metrics: [
        { name: "screenPageViews" },
        { name: "sessions" },
        { name: "activeUsers" },
      ],
    }),
    client.runReport({
      property,
      dateRanges,
      dimensions: [
        { name: "eventName" },
        { name: "sessionDefaultChannelGroup" },
      ],
      metrics: [{ name: "eventCount" }],
      dimensionFilter: {
        filter: {
          fieldName: "eventName",
          inListFilter: {
            values: ["scroll", "form_start", "waitlist_signup"],
          },
        },
      },
    }),
    client.runReport({
      property,
      dateRanges,
      metrics: [
        { name: "screenPageViews" },
        { name: "sessions" },
        { name: "activeUsers" },
      ],
    }),
    client.runReport({
      property,
      dateRanges,
      dimensions: [{ name: "eventName" }],
      metrics: [{ name: "eventCount" }],
      dimensionFilter: {
        filter: {
          fieldName: "eventName",
          inListFilter: {
            values: ["scroll", "form_start", "waitlist_signup"],
          },
        },
      },
    }),
  ]);

  // Q1: segmented metrics → paid/organic buckets per range
  {
    const r = metricsResp[0];
    const drI = dimIdx(r, "dateRange");
    const cgI = dimIdx(r, "sessionDefaultChannelGroup");
    for (const row of r?.rows ?? []) {
      const preset = row.dimensionValues?.[drI]?.value as GaRangePreset;
      if (!preset || !result[preset]) continue;
      const group = row.dimensionValues?.[cgI]?.value || "";
      const bucket =
        classifyGaChannelGroup(group) === "paid"
          ? result[preset].paid
          : result[preset].organic;
      bucket.pageViews += n(row.metricValues?.[0]?.value);
      bucket.sessions += n(row.metricValues?.[1]?.value);
      bucket.activeUsers += n(row.metricValues?.[2]?.value);
    }
  }

  // Q2: segmented events → paid/organic event counts per range
  {
    const r = eventsResp[0];
    const drI = dimIdx(r, "dateRange");
    const cgI = dimIdx(r, "sessionDefaultChannelGroup");
    const enI = dimIdx(r, "eventName");
    for (const row of r?.rows ?? []) {
      const preset = row.dimensionValues?.[drI]?.value as GaRangePreset;
      if (!preset || !result[preset]) continue;
      const group = row.dimensionValues?.[cgI]?.value || "";
      const name = row.dimensionValues?.[enI]?.value || "";
      const bucket =
        classifyGaChannelGroup(group) === "paid"
          ? result[preset].paid
          : result[preset].organic;
      const count = n(row.metricValues?.[0]?.value);
      if (name === "scroll") bucket.scrolls += count;
      else if (name === "form_start") bucket.formStarts += count;
      else if (name === "waitlist_signup") bucket.waitlistSignups += count;
    }
  }

  // Q3: unsegmented metrics → the "all" bucket (one row per range)
  {
    const r = allMetricsResp[0];
    const drI = dimIdx(r, "dateRange");
    for (const row of r?.rows ?? []) {
      const preset = row.dimensionValues?.[drI]?.value as GaRangePreset;
      if (!preset || !result[preset]) continue;
      result[preset].all.pageViews = n(row.metricValues?.[0]?.value);
      result[preset].all.sessions = n(row.metricValues?.[1]?.value);
      result[preset].all.activeUsers = n(row.metricValues?.[2]?.value);
    }
  }

  // Q4: unsegmented events → the "all" bucket event counts
  {
    const r = allEventsResp[0];
    const drI = dimIdx(r, "dateRange");
    const enI = dimIdx(r, "eventName");
    for (const row of r?.rows ?? []) {
      const preset = row.dimensionValues?.[drI]?.value as GaRangePreset;
      if (!preset || !result[preset]) continue;
      const name = row.dimensionValues?.[enI]?.value || "";
      const count = n(row.metricValues?.[0]?.value);
      if (name === "scroll") result[preset].all.scrolls = count;
      else if (name === "form_start") result[preset].all.formStarts = count;
      else if (name === "waitlist_signup") result[preset].all.waitlistSignups = count;
    }
  }

  return result;
}

/**
 * Daily sessions + signups for the last N days, oldest first.
 *
 * GA's API only returns rows for days with ≥1 session. We pre-seed the
 * result map with every date in the window at zero so the dashboard chart
 * always renders N evenly-spaced bars (otherwise a single active day shows
 * as one bar filling the full width).
 */
export async function getDailyTrend(days: number = 30): Promise<DailyTrendPoint[]> {
  const { client, property } = getClient();

  const [sessionsResp, signupsResp] = await Promise.all([
    client.runReport({
      property,
      dateRanges: [{ startDate: `${days}daysAgo`, endDate: "today" }],
      dimensions: [{ name: "date" }],
      metrics: [{ name: "sessions" }],
      orderBys: [{ dimension: { dimensionName: "date" } }],
    }),
    client.runReport({
      property,
      dateRanges: [{ startDate: `${days}daysAgo`, endDate: "today" }],
      dimensions: [{ name: "date" }],
      metrics: [{ name: "eventCount" }],
      dimensionFilter: {
        filter: {
          fieldName: "eventName",
          stringFilter: { value: "waitlist_signup" },
        },
      },
      orderBys: [{ dimension: { dimensionName: "date" } }],
    }),
  ]);

  // Pre-seed every date in the window at zero so empty days still render.
  const map = new Map<string, DailyTrendPoint>();
  const now = new Date();
  // Use UTC-ish ISO date strings. Off-by-one at midnight property timezone
  // is acceptable for the visual.
  for (let i = days; i >= 0; i--) {
    const d = new Date(now);
    d.setUTCDate(now.getUTCDate() - i);
    const dateStr = d.toISOString().slice(0, 10);
    map.set(dateStr, { date: dateStr, sessions: 0, signups: 0 });
  }

  for (const r of sessionsResp[0]?.rows ?? []) {
    const date = isoDateFromGaYmd(r.dimensionValues?.[0]?.value || "");
    const existing = map.get(date) || { date, sessions: 0, signups: 0 };
    existing.sessions = n(r.metricValues?.[0]?.value);
    map.set(date, existing);
  }
  for (const r of signupsResp[0]?.rows ?? []) {
    const date = isoDateFromGaYmd(r.dimensionValues?.[0]?.value || "");
    const existing = map.get(date) || { date, sessions: 0, signups: 0 };
    existing.signups = n(r.metricValues?.[0]?.value);
    map.set(date, existing);
  }

  return Array.from(map.values()).sort((a, b) => a.date.localeCompare(b.date));
}

/**
 * Traffic source/medium breakdown, top N per range across one or more
 * range presets. Bundled into a single GA call via dateRanges so loading
 * all four windows stays within GA's concurrent-request quota.
 *
 * The bundled query is over-fetched (limit × presets × ~2) because GA
 * sorts the response globally, not per-range — without over-fetching,
 * the smallest range can come back empty if the larger ranges saturate
 * the limit. After bucketing we sort and slice each range to `limit`.
 */
export async function getTrafficSources(
  presets: GaRangePreset[] | GaRangePreset = ["30d"],
  limit: number = 10
): Promise<Record<GaRangePreset, TrafficSource[]>> {
  const presetList: GaRangePreset[] = Array.isArray(presets) ? presets : [presets];
  const { client, property } = getClient();
  const dateRanges = presetList.map((p) => {
    const { startDate, endDate } = gaRangeBounds(p);
    return { name: p, startDate, endDate };
  });

  const overFetch = Math.max(50, limit * presetList.length * 4);

  const [resp] = await client.runReport({
    property,
    dateRanges,
    dimensions: [
      { name: "sessionSource" },
      { name: "sessionMedium" },
    ],
    metrics: [{ name: "sessions" }],
    orderBys: [{ metric: { metricName: "sessions" }, desc: true }],
    limit: overFetch,
  });

  const buckets = {} as Record<GaRangePreset, TrafficSource[]>;
  for (const p of presetList) buckets[p] = [];

  const drI = dimIdx(resp, "dateRange");
  const srcI = dimIdx(resp, "sessionSource");
  const medI = dimIdx(resp, "sessionMedium");

  for (const row of resp.rows ?? []) {
    const preset = row.dimensionValues?.[drI]?.value as GaRangePreset;
    if (!preset || !buckets[preset]) continue;
    buckets[preset].push({
      source: row.dimensionValues?.[srcI]?.value || "(unknown)",
      medium: row.dimensionValues?.[medI]?.value || "(none)",
      sessions: n(row.metricValues?.[0]?.value),
    });
  }

  // Each bucket is already sessions-desc within the global response order
  // (it was sorted before bucketing), but re-sort and slice defensively.
  for (const p of presetList) {
    buckets[p].sort((a, b) => b.sessions - a.sessions);
    buckets[p] = buckets[p].slice(0, limit);
  }

  return buckets;
}

/**
 * Active users right now (last 30 minutes).
 */
export async function getRealtimeActiveUsers(): Promise<RealtimeSnapshot> {
  const { client, property } = getClient();

  const [resp] = await client.runRealtimeReport({
    property,
    metrics: [{ name: "activeUsers" }],
  });

  const v = resp.rows?.[0]?.metricValues?.[0]?.value;
  return { activeUsers: n(v) };
}
