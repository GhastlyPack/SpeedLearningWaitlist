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
export async function getHeroMetrics(
  preset: GaRangePreset = "30d"
): Promise<HeroMetrics> {
  const { client, property } = getClient();
  const { startDate, endDate } = gaRangeBounds(preset);

  // Two parallel queries: one for top-line metrics (sessions/views/users),
  // one for event-count breakdown.
  const [metricsResp, eventsResp] = await Promise.all([
    client.runReport({
      property,
      dateRanges: [{ startDate, endDate }],
      metrics: [
        { name: "screenPageViews" },
        { name: "sessions" },
        { name: "activeUsers" },
      ],
    }),
    client.runReport({
      property,
      dateRanges: [{ startDate, endDate }],
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

  const row = metricsResp[0]?.rows?.[0];
  const pageViews = n(row?.metricValues?.[0]?.value);
  const sessions = n(row?.metricValues?.[1]?.value);
  const activeUsers = n(row?.metricValues?.[2]?.value);

  const eventCounts: Record<string, number> = {};
  for (const eventRow of eventsResp[0]?.rows ?? []) {
    const name = eventRow.dimensionValues?.[0]?.value || "";
    const count = n(eventRow.metricValues?.[0]?.value);
    eventCounts[name] = count;
  }

  return {
    pageViews,
    sessions,
    activeUsers,
    scrolls: eventCounts.scroll || 0,
    formStarts: eventCounts.form_start || 0,
    waitlistSignups: eventCounts.waitlist_signup || 0,
  };
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
 * Traffic source/medium breakdown.
 */
export async function getTrafficSources(
  preset: GaRangePreset = "30d",
  limit: number = 10
): Promise<TrafficSource[]> {
  const { client, property } = getClient();
  const { startDate, endDate } = gaRangeBounds(preset);

  const [resp] = await client.runReport({
    property,
    dateRanges: [{ startDate, endDate }],
    dimensions: [
      { name: "sessionSource" },
      { name: "sessionMedium" },
    ],
    metrics: [{ name: "sessions" }],
    orderBys: [{ metric: { metricName: "sessions" }, desc: true }],
    limit,
  });

  return (resp.rows ?? []).map((r) => ({
    source: r.dimensionValues?.[0]?.value || "(unknown)",
    medium: r.dimensionValues?.[1]?.value || "(none)",
    sessions: n(r.metricValues?.[0]?.value),
  }));
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
