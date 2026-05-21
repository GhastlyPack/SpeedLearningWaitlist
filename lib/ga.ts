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
  startDate: string = "30daysAgo",
  endDate: string = "today"
): Promise<HeroMetrics> {
  const { client, property } = getClient();

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

  // Merge by date
  const map = new Map<string, DailyTrendPoint>();

  for (const r of sessionsResp[0]?.rows ?? []) {
    const date = isoDateFromGaYmd(r.dimensionValues?.[0]?.value || "");
    map.set(date, {
      date,
      sessions: n(r.metricValues?.[0]?.value),
      signups: 0,
    });
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
  startDate: string = "30daysAgo",
  endDate: string = "today",
  limit: number = 10
): Promise<TrafficSource[]> {
  const { client, property } = getClient();

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
