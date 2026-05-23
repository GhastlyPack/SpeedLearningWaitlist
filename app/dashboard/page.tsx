import {
  getHeroMetrics,
  getDailyTrend,
  getTrafficSources,
  getRealtimeActiveUsers,
  type HeroMetrics,
  type DailyTrendPoint,
  type TrafficSource,
} from "@/lib/ga";
import { getWaitlistSummary, type WaitlistPerson } from "@/lib/cio";
import {
  getAccountInsights,
  getTopCampaigns,
  getTopAds,
  type MetaInsight,
  type MetaCampaign,
  type MetaAd,
} from "@/lib/meta";
import MetaSections from "./MetaSections";

type MetaWindow = "1d" | "7d" | "30d";

// Render fresh on each request. Internal dashboard sees ~dozens of loads
// per day, so we don't bother with ISR or revalidate windows; both would
// require env vars at build time and complicate cache invalidation.
export const dynamic = "force-dynamic";

// -----------------------------------------------------------------------------
// Data loader

interface DashboardData {
  heroGa: HeroMetrics | null;
  heroGaError?: string;
  realtimeUsers: number | null;
  realtimeError?: string;
  trend: DailyTrendPoint[];
  trendError?: string;
  sources: TrafficSource[];
  sourcesError?: string;
  cioTotal: number | null;
  cioRecent: WaitlistPerson[];
  cioDailySignups: Record<string, number>;
  cioError?: string;
  metaSpend: Record<MetaWindow, MetaInsight | null>;
  metaSpendError?: string;
  metaCampaigns: Record<MetaWindow, MetaCampaign[]>;
  metaCampaignsError?: string;
  metaAds: Record<MetaWindow, MetaAd[]>;
  metaAdsError?: string;
}

async function loadData(): Promise<DashboardData> {
  const [
    heroRes,
    realtimeRes,
    trendRes,
    sourcesRes,
    cioRes,
    metaSpend1dRes,
    metaSpend7dRes,
    metaSpend30dRes,
    metaCampaigns1dRes,
    metaCampaigns7dRes,
    metaCampaigns30dRes,
    metaAds1dRes,
    metaAds7dRes,
    metaAds30dRes,
  ] = await Promise.allSettled([
    getHeroMetrics("30daysAgo", "today"),
    getRealtimeActiveUsers(),
    getDailyTrend(30),
    getTrafficSources("30daysAgo", "today", 10),
    getWaitlistSummary(20),
    getAccountInsights(1),
    getAccountInsights(7),
    getAccountInsights(30),
    getTopCampaigns(1, 5),
    getTopCampaigns(7, 5),
    getTopCampaigns(30, 5),
    getTopAds(1, 5),
    getTopAds(7, 5),
    getTopAds(30, 5),
  ]);

  const errMsg = (r: PromiseRejectedResult) =>
    r.reason instanceof Error ? r.reason.message : String(r.reason);

  return {
    heroGa: heroRes.status === "fulfilled" ? heroRes.value : null,
    heroGaError: heroRes.status === "rejected" ? errMsg(heroRes) : undefined,
    realtimeUsers:
      realtimeRes.status === "fulfilled" ? realtimeRes.value.activeUsers : null,
    realtimeError:
      realtimeRes.status === "rejected" ? errMsg(realtimeRes) : undefined,
    trend: trendRes.status === "fulfilled" ? trendRes.value : [],
    trendError: trendRes.status === "rejected" ? errMsg(trendRes) : undefined,
    sources: sourcesRes.status === "fulfilled" ? sourcesRes.value : [],
    sourcesError:
      sourcesRes.status === "rejected" ? errMsg(sourcesRes) : undefined,
    cioTotal: cioRes.status === "fulfilled" ? cioRes.value.total : null,
    cioRecent: cioRes.status === "fulfilled" ? cioRes.value.recent : [],
    cioDailySignups:
      cioRes.status === "fulfilled" ? cioRes.value.dailySignups : {},
    cioError: cioRes.status === "rejected" ? errMsg(cioRes) : undefined,
    metaSpend: {
      "1d": metaSpend1dRes.status === "fulfilled" ? metaSpend1dRes.value : null,
      "7d": metaSpend7dRes.status === "fulfilled" ? metaSpend7dRes.value : null,
      "30d": metaSpend30dRes.status === "fulfilled" ? metaSpend30dRes.value : null,
    },
    metaSpendError:
      [metaSpend1dRes, metaSpend7dRes, metaSpend30dRes].find(
        (r) => r.status === "rejected"
      )
        ? errMsg(
            [metaSpend1dRes, metaSpend7dRes, metaSpend30dRes].find(
              (r) => r.status === "rejected"
            ) as PromiseRejectedResult
          )
        : undefined,
    metaCampaigns: {
      "1d":
        metaCampaigns1dRes.status === "fulfilled"
          ? metaCampaigns1dRes.value
          : [],
      "7d":
        metaCampaigns7dRes.status === "fulfilled"
          ? metaCampaigns7dRes.value
          : [],
      "30d":
        metaCampaigns30dRes.status === "fulfilled"
          ? metaCampaigns30dRes.value
          : [],
    },
    metaCampaignsError: [
      metaCampaigns1dRes,
      metaCampaigns7dRes,
      metaCampaigns30dRes,
    ].find((r) => r.status === "rejected")
      ? errMsg(
          [
            metaCampaigns1dRes,
            metaCampaigns7dRes,
            metaCampaigns30dRes,
          ].find((r) => r.status === "rejected") as PromiseRejectedResult
        )
      : undefined,
    metaAds: {
      "1d": metaAds1dRes.status === "fulfilled" ? metaAds1dRes.value : [],
      "7d": metaAds7dRes.status === "fulfilled" ? metaAds7dRes.value : [],
      "30d": metaAds30dRes.status === "fulfilled" ? metaAds30dRes.value : [],
    },
    metaAdsError: [metaAds1dRes, metaAds7dRes, metaAds30dRes].find(
      (r) => r.status === "rejected"
    )
      ? errMsg(
          [metaAds1dRes, metaAds7dRes, metaAds30dRes].find(
            (r) => r.status === "rejected"
          ) as PromiseRejectedResult
        )
      : undefined,
  };
}

// -----------------------------------------------------------------------------
// Formatters

function fmt(n: number | null): string {
  if (n == null) return "—";
  return n.toLocaleString("en-US");
}

function money(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n)) return "—";
  return `$${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function pct(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n)) return "—";
  return `${n.toFixed(2)}%`;
}

function truncate(s: string, max: number): string {
  if (s.length <= max) return s;
  return s.slice(0, max - 1) + "…";
}

function statusLabel(status: string): string {
  // Meta status enums: ACTIVE, PAUSED, ARCHIVED, DELETED, etc.
  return status.charAt(0) + status.slice(1).toLowerCase();
}

function maskEmail(email: string): string {
  const [local, domain] = email.split("@");
  if (!domain) return email;
  if (local.length <= 2) return `${local[0]}*@${domain}`;
  return `${local.slice(0, 2)}${"*".repeat(Math.max(1, local.length - 2))}@${domain}`;
}

function timeAgo(iso?: string): string {
  if (!iso) return "—";
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return "—";
  const seconds = Math.max(0, Math.floor((Date.now() - then) / 1000));
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  const months = Math.floor(days / 30);
  return `${months}mo ago`;
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

// -----------------------------------------------------------------------------
// Page

export default async function DashboardPage() {
  const data = await loadData();

  // Conversion rate uses Customer.io's waitlist=true count as the canonical
  // signup number (it's the source of truth — deduped, deletions reflected,
  // never includes test events that were cleaned up). Denominator is GA's
  // active users over the same window, which is closer to "unique visitors"
  // than sessions. Falls back to sessions if active users is unavailable.
  const visitors =
    (data.heroGa?.activeUsers ?? 0) > 0
      ? data.heroGa!.activeUsers
      : data.heroGa?.sessions ?? 0;
  const cvr =
    data.cioTotal != null && visitors > 0
      ? ((data.cioTotal / visitors) * 100).toFixed(1)
      : null;

  // Overlay CIO daily signups onto the GA trend so the chart's red bars
  // reflect actual people (post-deletes), not raw GA event counts.
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
          Updated {now} · Auto-refresh 60s
        </div>
      </header>

      <main className="dash-main">
        {/* Hero metrics */}
        <div className="dash-hero">
          <div className="cell">
            <div className="label">Waitlist Signups</div>
            <div className="value accent">{fmt(data.cioTotal)}</div>
            <div className="sub">Customer.io · waitlist=true</div>
          </div>
          <div className="cell">
            <div className="label">Sessions · 30d</div>
            <div className="value">{fmt(data.heroGa?.sessions ?? null)}</div>
            <div className="sub">Page views: {fmt(data.heroGa?.pageViews ?? null)}</div>
          </div>
          <div className="cell">
            <div className="label">Conversion · 30d</div>
            <div className="value">{cvr ? `${cvr}%` : "—"}</div>
            <div className="sub">
              {fmt(data.cioTotal)} signups / {fmt(visitors)} visitors
            </div>
          </div>
          <div className="cell">
            <div className="label">Active right now</div>
            <div className="value">{fmt(data.realtimeUsers)}</div>
            <div className="sub">Last 30 min</div>
          </div>
        </div>

        {/* Error banners */}
        {data.cioError && (
          <div className="dash-error">
            <strong>Customer.io</strong>
            {data.cioError}
          </div>
        )}
        {data.heroGaError && (
          <div className="dash-error">
            <strong>GA4 — metrics</strong>
            {data.heroGaError}
          </div>
        )}

        {/* Daily trend */}
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

        {/* Two-column: sources + funnel */}
        <div className="dash-row-2">
          <section className="dash-section">
            <div className="header">
              <h2>Top traffic sources · 30d</h2>
              <div className="meta">by sessions</div>
            </div>
            <div className="dash-source-list">
              {data.sources.length === 0 ? (
                <div className="empty" style={{ padding: 24, textAlign: "center" }}>
                  {data.sourcesError ? data.sourcesError : "No data yet."}
                </div>
              ) : (
                data.sources.map((s, i) => (
                  <div key={`${s.source}-${s.medium}-${i}`} className="dash-source-row">
                    <div className="name">
                      {s.source}
                      <span className="medium">/ {s.medium}</span>
                    </div>
                    <div className="count">{fmt(s.sessions)}</div>
                  </div>
                ))
              )}
            </div>
          </section>

          <section className="dash-section">
            <div className="header">
              <h2>Funnel · 30d</h2>
              <div className="meta">GA4 events</div>
            </div>
            <div className="body">
              <FunnelRow
                label="Page views"
                value={data.heroGa?.pageViews ?? null}
                base={data.heroGa?.pageViews ?? null}
              />
              <FunnelRow
                label="Form starts"
                value={data.heroGa?.formStarts ?? null}
                base={data.heroGa?.pageViews ?? null}
              />
              <FunnelRow
                label="Waitlist signups"
                value={data.cioTotal}
                base={data.heroGa?.pageViews ?? null}
                accent
              />
              <FunnelRow
                label="Scroll events"
                value={data.heroGa?.scrolls ?? null}
                base={data.heroGa?.pageViews ?? null}
                subtle
              />
            </div>
          </section>
        </div>

        {/* Meta — three sections with a shared time-range toggle */}
        <MetaSections
          spend={data.metaSpend}
          campaigns={data.metaCampaigns}
          ads={data.metaAds}
          spendError={data.metaSpendError}
          campaignsError={data.metaCampaignsError}
          adsError={data.metaAdsError}
        />

        {/* Recent signups */}
        <section className="dash-section">
          <div className="header">
            <h2>Recent signups · last 20</h2>
            <div className="meta">Customer.io</div>
          </div>
          <table className="dash-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Email</th>
                <th>Source / Campaign</th>
                <th>When</th>
              </tr>
            </thead>
            <tbody>
              {data.cioRecent.length === 0 ? (
                <tr>
                  <td className="empty" colSpan={4}>
                    {data.cioError ? data.cioError : "No signups yet."}
                  </td>
                </tr>
              ) : (
                data.cioRecent.map((p) => (
                  <tr key={p.cioId}>
                    <td>
                      {p.firstName || "—"}
                      {p.lastName ? ` ${p.lastName}` : ""}
                    </td>
                    <td className="email">{maskEmail(p.email)}</td>
                    <td className="source">
                      <SourceCell person={p} />
                    </td>
                    <td className="when">{timeAgo(p.signedUpAt)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </section>
      </main>

      <footer className="dash-footer">
        <div>SpeedLearning · Internal dashboard</div>
        <div>Cache TTL 60s · GA4 + Customer.io</div>
      </footer>
    </div>
  );
}

function SourceCell({ person }: { person: WaitlistPerson }) {
  // Priority for "main" source display:
  // utm_source (paid/social/referral) > referred_by (organic referral) > "direct"
  const primary = person.utmSource || (person.referredBy ? "referral" : null) || "direct";
  // Secondary line: campaign details or referrer code
  const secondary =
    person.utmCampaign ||
    (person.utmMedium && person.utmMedium !== person.utmSource
      ? person.utmMedium
      : null) ||
    (person.referredBy ? `ref ${person.referredBy.slice(0, 8)}` : null);

  return (
    <span>
      <span style={{ color: "var(--ink)" }}>{primary}</span>
      {secondary ? (
        <>
          <span style={{ color: "var(--ink-mute)" }}> · </span>
          <span style={{ color: "var(--ink-mute)" }}>{secondary}</span>
        </>
      ) : null}
    </span>
  );
}

function FunnelRow({
  label,
  value,
  base,
  accent,
  subtle,
}: {
  label: string;
  value: number | null;
  base: number | null;
  accent?: boolean;
  subtle?: boolean;
}) {
  const pct =
    value != null && base != null && base > 0
      ? `${((value / base) * 100).toFixed(1)}%`
      : "—";

  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "1fr auto auto",
        gap: 18,
        alignItems: "baseline",
        padding: "10px 0",
        borderTop: "1px solid var(--rule)",
      }}
    >
      <div
        style={{
          fontFamily: "var(--font-mono), monospace",
          fontSize: 12.5,
          letterSpacing: 0.4,
          color: subtle ? "var(--ink-mute)" : "var(--ink)",
        }}
      >
        {label}
      </div>
      <div
        style={{
          fontFamily: "var(--font-mono), monospace",
          fontSize: 14,
          color: accent ? "var(--ax)" : "var(--ink)",
          fontVariantNumeric: "tabular-nums",
        }}
      >
        {fmt(value)}
      </div>
      <div
        style={{
          fontFamily: "var(--font-mono), monospace",
          fontSize: 11,
          letterSpacing: 0.6,
          color: "var(--ink-mute)",
          minWidth: 50,
          textAlign: "right",
        }}
      >
        {pct}
      </div>
    </div>
  );
}
