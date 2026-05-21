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
  cioError?: string;
}

async function loadData(): Promise<DashboardData> {
  const [heroRes, realtimeRes, trendRes, sourcesRes, cioRes] =
    await Promise.allSettled([
      getHeroMetrics("30daysAgo", "today"),
      getRealtimeActiveUsers(),
      getDailyTrend(30),
      getTrafficSources("30daysAgo", "today", 10),
      getWaitlistSummary(20),
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
    cioError: cioRes.status === "rejected" ? errMsg(cioRes) : undefined,
  };
}

// -----------------------------------------------------------------------------
// Formatters

function fmt(n: number | null): string {
  if (n == null) return "—";
  return n.toLocaleString("en-US");
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

  // Conversion rate = waitlist signups / page views. Page views is a more
  // stable denominator than sessions for a single-page lander — sessions
  // can be smaller than the count of signup events when users submit
  // multiple times within one session (common during QA/test traffic) and
  // produce nonsensical >100% rates. Matches the Funnel section exactly.
  const cvr =
    data.heroGa && data.heroGa.pageViews > 0
      ? ((data.heroGa.waitlistSignups / data.heroGa.pageViews) * 100).toFixed(1)
      : null;

  const maxTrend = Math.max(1, ...data.trend.map((d) => d.sessions));

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
              GA signups: {fmt(data.heroGa?.waitlistSignups ?? null)}
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
          {data.trend.length === 0 ? (
            <div className="dash-table">
              <div className="empty">
                {data.trendError ? data.trendError : "No data yet."}
              </div>
            </div>
          ) : (
            <>
              <div className="dash-trend">
                {data.trend.map((point) => {
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
                <span>{data.trend[0] && shortDate(data.trend[0].date)}</span>
                <span>
                  {data.trend[data.trend.length - 1] &&
                    shortDate(data.trend[data.trend.length - 1].date)}
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
                value={data.heroGa?.waitlistSignups ?? null}
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
                <th>Source</th>
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
                    <td className="source">{p.source || "—"}</td>
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
