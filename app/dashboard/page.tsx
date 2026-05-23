import {
  getHeroMetrics,
  getDailyTrend,
  getTrafficSources,
  getRealtimeActiveUsers,
  type HeroMetrics,
  type DailyTrendPoint,
  type TrafficSource,
  type GaRangePreset,
  type GaTrafficType,
} from "@/lib/ga";
import { getWaitlistSummary, type WaitlistPerson } from "@/lib/cio";
import {
  getAccountInsights,
  getTopCampaigns,
  getTopAds,
  type MetaInsight,
  type MetaCampaign,
  type MetaAd,
  type RangePreset,
} from "@/lib/meta";
import MetaSections from "./MetaSections";
import TopSections from "./TopSections";
import SignupPoller from "./SignupPoller";

// Render fresh on each request. Internal dashboard sees ~dozens of loads
// per day, so we don't bother with ISR or revalidate windows; both would
// require env vars at build time and complicate cache invalidation.
export const dynamic = "force-dynamic";

// -----------------------------------------------------------------------------
// Data loader

interface DashboardData {
  /** Hero GA metrics, indexed first by range then by traffic-type bucket. */
  heroGa: Record<GaRangePreset, Record<GaTrafficType, HeroMetrics> | null>;
  heroGaError?: string;
  realtimeUsers: number | null;
  realtimeError?: string;
  trend: DailyTrendPoint[];
  trendError?: string;
  sources: Record<GaRangePreset, TrafficSource[]>;
  sourcesError?: string;
  cioTotal: number | null;
  cioRecent: WaitlistPerson[];
  cioDailySignups: Record<string, number>;
  /** CIO signup totals bucketed by (range × traffic type). */
  cioSignupsByRange: Record<GaTrafficType, Record<GaRangePreset, number>>;
  cioError?: string;
  metaSpend: Record<RangePreset, MetaInsight | null>;
  metaSpendError?: string;
  metaCampaigns: Record<RangePreset, MetaCampaign[]>;
  metaCampaignsError?: string;
  metaAds: Record<RangePreset, MetaAd[]>;
  metaAdsError?: string;
}

/**
 * Sum a daily-signups map over the UTC days that fall within a range preset.
 * Used both for the unfiltered total and for the paid/organic buckets.
 */
function sumDailyOverRange(
  daily: Record<string, number>,
  preset: GaRangePreset,
  fallbackTotal?: number
): number {
  if (preset === "all") {
    return (
      fallbackTotal ?? Object.values(daily).reduce((a, b) => a + b, 0)
    );
  }
  const days = preset === "24h" ? 2 : preset === "7d" ? 7 : 30;
  const now = new Date();
  let sum = 0;
  for (let i = 0; i < days; i++) {
    const d = new Date(now);
    d.setUTCDate(now.getUTCDate() - i);
    const dateStr = d.toISOString().slice(0, 10);
    sum += daily[dateStr] || 0;
  }
  return sum;
}

async function loadData(): Promise<DashboardData> {
  const ALL_RANGES: GaRangePreset[] = ["24h", "7d", "30d", "all"];

  const [
    heroGaRes,
    realtimeRes,
    trendRes,
    sourcesRes,
    cioRes,
    metaSpend24hRes,
    metaSpend7dRes,
    metaSpend30dRes,
    metaSpendAllRes,
    metaCampaigns24hRes,
    metaCampaigns7dRes,
    metaCampaigns30dRes,
    metaCampaignsAllRes,
    metaAds24hRes,
    metaAds7dRes,
    metaAds30dRes,
    metaAdsAllRes,
  ] = await Promise.allSettled([
    // Both GA "fan-out" functions take an array of presets and bundle
    // every range into a single multi-dateRanges call. Without bundling
    // the dashboard fires 16+ concurrent GA queries and trips the
    // 10-per-property RESOURCE_EXHAUSTED quota.
    getHeroMetrics(ALL_RANGES),
    getRealtimeActiveUsers(),
    getDailyTrend(30),
    getTrafficSources(ALL_RANGES, 10),
    getWaitlistSummary(20),
    getAccountInsights("24h"),
    getAccountInsights("7d"),
    getAccountInsights("30d"),
    getAccountInsights("all"),
    getTopCampaigns("24h", 5),
    getTopCampaigns("7d", 5),
    getTopCampaigns("30d", 5),
    getTopCampaigns("all", 5),
    getTopAds("24h", 5),
    getTopAds("7d", 5),
    getTopAds("30d", 5),
    getTopAds("all", 5),
  ]);

  const errMsg = (r: PromiseRejectedResult) =>
    r.reason instanceof Error ? r.reason.message : String(r.reason);

  const heroGaRejected =
    heroGaRes.status === "rejected" ? heroGaRes : undefined;

  const sourcesRejected =
    sourcesRes.status === "rejected" ? sourcesRes : undefined;

  const cioDailySignups =
    cioRes.status === "fulfilled" ? cioRes.value.dailySignups : {};
  const cioDailyByTraffic =
    cioRes.status === "fulfilled"
      ? cioRes.value.dailySignupsByTraffic
      : { paid: {}, organic: {} };
  const cioTotalByTraffic =
    cioRes.status === "fulfilled"
      ? cioRes.value.totalByTraffic
      : { paid: 0, organic: 0, all: 0 };
  const cioTotal = cioRes.status === "fulfilled" ? cioRes.value.total : null;

  const ranges: GaRangePreset[] = ["24h", "7d", "30d", "all"];
  const cioSignupsByRange: Record<GaTrafficType, Record<GaRangePreset, number>> = {
    paid: {} as Record<GaRangePreset, number>,
    organic: {} as Record<GaRangePreset, number>,
    all: {} as Record<GaRangePreset, number>,
  };
  for (const r of ranges) {
    cioSignupsByRange.paid[r] = sumDailyOverRange(
      cioDailyByTraffic.paid,
      r,
      cioTotalByTraffic.paid
    );
    cioSignupsByRange.organic[r] = sumDailyOverRange(
      cioDailyByTraffic.organic,
      r,
      cioTotalByTraffic.organic
    );
    cioSignupsByRange.all[r] = sumDailyOverRange(
      cioDailySignups,
      r,
      cioTotal ?? undefined
    );
  }

  // Unwrap the bundled GA responses. If the bundle settled rejected we
  // fall back to null/empty per range so the dashboard still renders.
  const heroBundle =
    heroGaRes.status === "fulfilled" ? heroGaRes.value : null;
  const sourcesBundle =
    sourcesRes.status === "fulfilled" ? sourcesRes.value : null;

  return {
    heroGa: {
      "24h": heroBundle?.["24h"] ?? null,
      "7d": heroBundle?.["7d"] ?? null,
      "30d": heroBundle?.["30d"] ?? null,
      "all": heroBundle?.["all"] ?? null,
    },
    heroGaError: heroGaRejected ? errMsg(heroGaRejected) : undefined,
    realtimeUsers:
      realtimeRes.status === "fulfilled" ? realtimeRes.value.activeUsers : null,
    realtimeError:
      realtimeRes.status === "rejected" ? errMsg(realtimeRes) : undefined,
    trend: trendRes.status === "fulfilled" ? trendRes.value : [],
    trendError: trendRes.status === "rejected" ? errMsg(trendRes) : undefined,
    sources: {
      "24h": sourcesBundle?.["24h"] ?? [],
      "7d": sourcesBundle?.["7d"] ?? [],
      "30d": sourcesBundle?.["30d"] ?? [],
      "all": sourcesBundle?.["all"] ?? [],
    },
    sourcesError: sourcesRejected ? errMsg(sourcesRejected) : undefined,
    cioTotal,
    cioRecent: cioRes.status === "fulfilled" ? cioRes.value.recent : [],
    cioDailySignups,
    cioSignupsByRange,
    cioError: cioRes.status === "rejected" ? errMsg(cioRes) : undefined,
    metaSpend: {
      "24h": metaSpend24hRes.status === "fulfilled" ? metaSpend24hRes.value : null,
      "7d": metaSpend7dRes.status === "fulfilled" ? metaSpend7dRes.value : null,
      "30d": metaSpend30dRes.status === "fulfilled" ? metaSpend30dRes.value : null,
      "all": metaSpendAllRes.status === "fulfilled" ? metaSpendAllRes.value : null,
    },
    metaSpendError:
      [metaSpend24hRes, metaSpend7dRes, metaSpend30dRes, metaSpendAllRes].find(
        (r) => r.status === "rejected"
      )
        ? errMsg(
            [metaSpend24hRes, metaSpend7dRes, metaSpend30dRes, metaSpendAllRes].find(
              (r) => r.status === "rejected"
            ) as PromiseRejectedResult
          )
        : undefined,
    metaCampaigns: {
      "24h": metaCampaigns24hRes.status === "fulfilled" ? metaCampaigns24hRes.value : [],
      "7d": metaCampaigns7dRes.status === "fulfilled" ? metaCampaigns7dRes.value : [],
      "30d": metaCampaigns30dRes.status === "fulfilled" ? metaCampaigns30dRes.value : [],
      "all": metaCampaignsAllRes.status === "fulfilled" ? metaCampaignsAllRes.value : [],
    },
    metaCampaignsError: [
      metaCampaigns24hRes,
      metaCampaigns7dRes,
      metaCampaigns30dRes,
      metaCampaignsAllRes,
    ].find((r) => r.status === "rejected")
      ? errMsg(
          [
            metaCampaigns24hRes,
            metaCampaigns7dRes,
            metaCampaigns30dRes,
            metaCampaignsAllRes,
          ].find((r) => r.status === "rejected") as PromiseRejectedResult
        )
      : undefined,
    metaAds: {
      "24h": metaAds24hRes.status === "fulfilled" ? metaAds24hRes.value : [],
      "7d": metaAds7dRes.status === "fulfilled" ? metaAds7dRes.value : [],
      "30d": metaAds30dRes.status === "fulfilled" ? metaAds30dRes.value : [],
      "all": metaAdsAllRes.status === "fulfilled" ? metaAdsAllRes.value : [],
    },
    metaAdsError: [metaAds24hRes, metaAds7dRes, metaAds30dRes, metaAdsAllRes].find(
      (r) => r.status === "rejected"
    )
      ? errMsg(
          [metaAds24hRes, metaAds7dRes, metaAds30dRes, metaAdsAllRes].find(
            (r) => r.status === "rejected"
          ) as PromiseRejectedResult
        )
      : undefined,
  };
}

// -----------------------------------------------------------------------------
// Formatters used here (more live in TopSections.tsx)

function fmt(n: number | null): string {
  if (n == null) return "—";
  return n.toLocaleString("en-US");
}

function shortDate(yyyymmdd: string): string {
  // "2026-05-21" -> "May 21"
  if (yyyymmdd.length !== 10) return yyyymmdd;
  const month = new Date(yyyymmdd + "T00:00:00Z").toLocaleString("en-US", {
    month: "short",
    timeZone: "UTC",
  });
  const day = yyyymmdd.slice(8, 10).replace(/^0/, "");
  return `${month} ${day}`;
}

// Suppress unused-import warning on fmt — used inside the trend chart.
void fmt;

// -----------------------------------------------------------------------------
// Page

export default async function DashboardPage() {
  const data = await loadData();

  // Overlay CIO daily signups onto the GA trend so the chart's red bars
  // reflect actual people (post-deletes), not raw GA event counts.
  // Trend chart shows ALL traffic — it's a long-time-series visualization;
  // we deliberately don't filter it by the paid/organic toggle (yet).
  const trendForChart = data.trend.map((point) => ({
    ...point,
    signups: data.cioDailySignups[point.date] || 0,
  }));

  const maxTrend = Math.max(1, ...trendForChart.map((d) => d.sessions));

  const now = new Date().toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });

  return (
    <div className="dash-page">
      <header className="dash-topbar">
        <div className="left">
          <div className="brand">
            <span className="brand-mark" />
            SpeedLearning
          </div>
          <div className="crumb">Internal · Dashboard</div>
        </div>
        <div className="right">
          Updated {now} · Watching for new signups
        </div>
      </header>

      {/* Invisible: polls /api/latest-signup every 30s and refreshes
          the page when a new signup lands. Renders no DOM. */}
      <SignupPoller />

      <main className="dash-main">
        {/* Hero + traffic sources + funnel + recent signups, all driven by
            the range + traffic-type toggles. */}
        <TopSections
          heroGa={data.heroGa}
          heroGaError={data.heroGaError}
          sources={data.sources}
          sourcesError={data.sourcesError}
          cioSignupsByRange={data.cioSignupsByRange}
          cioTotal={data.cioTotal}
          cioError={data.cioError}
          realtimeUsers={data.realtimeUsers}
          cioRecent={data.cioRecent}
        />

        {/* Daily trend — pinned to 30 days, unfiltered by traffic type.
            This is a long-time-series visualization; the toggles up top
            apply to point-in-time metrics. */}
        <section className="dash-section">
          <div className="header">
            <h2>Daily sessions &amp; signups · last 30 days</h2>
            <div className="meta">red bars = signups landed</div>
          </div>
          {trendForChart.length === 0 ? (
            <div className="dash-table">
              <div className="empty">
                {data.trendError ? data.trendError : "No data yet."}
              </div>
            </div>
          ) : (
            <>
              <div className="dash-trend">
                {trendForChart.map((point) => {
                  const heightPct = Math.max(
                    1,
                    Math.round((point.sessions / maxTrend) * 100)
                  );
                  return (
                    <div
                      key={point.date}
                      className={`bar${point.signups > 0 ? " has-signup" : ""}`}
                      style={{ height: `${heightPct}%` }}
                    >
                      <div className="tip">
                        {shortDate(point.date)} · {point.sessions} sessions · {point.signups} signups
                      </div>
                    </div>
                  );
                })}
              </div>
              <div className="dash-trend-axis">
                <span>{trendForChart[0] && shortDate(trendForChart[0].date)}</span>
                <span>
                  {trendForChart[trendForChart.length - 1] &&
                    shortDate(trendForChart[trendForChart.length - 1].date)}
                </span>
              </div>
            </>
          )}
        </section>

        {/* Meta — three sections with a shared time-range toggle */}
        <MetaSections
          spend={data.metaSpend}
          campaigns={data.metaCampaigns}
          ads={data.metaAds}
          spendError={data.metaSpendError}
          campaignsError={data.metaCampaignsError}
          adsError={data.metaAdsError}
        />
      </main>

      <footer className="dash-footer">
        <div>SpeedLearning · Internal dashboard</div>
        <div>Cache TTL 60s · GA4 + Customer.io</div>
      </footer>
    </div>
  );
}
