"use client";

import { useState } from "react";
import type {
  GaRangePreset,
  GaTrafficType,
  HeroMetrics,
  TrafficSource,
} from "@/lib/ga";
import type { WaitlistPerson } from "@/lib/cio";

interface Props {
  /** Hero metrics indexed by range, then by traffic-type bucket. */
  heroGa: Record<GaRangePreset, Record<GaTrafficType, HeroMetrics> | null>;
  heroGaError?: string;
  sources: Record<GaRangePreset, TrafficSource[]>;
  sourcesError?: string;
  /** CIO signup counts bucketed by (traffic-type, range). */
  cioSignupsByRange: Record<GaTrafficType, Record<GaRangePreset, number>>;
  cioTotal: number | null;
  cioError?: string;
  realtimeUsers: number | null;
  cioRecent: WaitlistPerson[];
}

const RANGES: GaRangePreset[] = ["24h", "7d", "30d", "all"];
const TRAFFIC_TYPES: GaTrafficType[] = ["all", "paid", "organic"];

function rangeLabel(r: GaRangePreset): string {
  return r === "24h" ? "24h" : r === "7d" ? "7d" : r === "30d" ? "30d" : "All";
}

function descriptiveRange(r: GaRangePreset): string {
  return r === "24h"
    ? "last 24h"
    : r === "7d"
    ? "last 7d"
    : r === "30d"
    ? "last 30d"
    : "all time";
}

function trafficLabel(t: GaTrafficType): string {
  return t === "all" ? "All" : t === "paid" ? "Paid" : "Organic";
}

function fmt(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n)) return "—";
  return Number(n).toLocaleString("en-US");
}

function truncate(s: string, max: number): string {
  if (s.length <= max) return s;
  return s.slice(0, max - 1) + "…";
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

function RangeToggle({
  value,
  onChange,
}: {
  value: GaRangePreset;
  onChange: (v: GaRangePreset) => void;
}) {
  return (
    <div className="range-toggle">
      {RANGES.map((r) => (
        <button
          key={r}
          type="button"
          className={`range-toggle-btn${r === value ? " active" : ""}`}
          onClick={() => onChange(r)}
        >
          {rangeLabel(r)}
        </button>
      ))}
    </div>
  );
}

function TrafficToggle({
  value,
  onChange,
}: {
  value: GaTrafficType;
  onChange: (v: GaTrafficType) => void;
}) {
  return (
    <div className="range-toggle">
      {TRAFFIC_TYPES.map((t) => (
        <button
          key={t}
          type="button"
          className={`range-toggle-btn${t === value ? " active" : ""}`}
          onClick={() => onChange(t)}
        >
          {trafficLabel(t)}
        </button>
      ))}
    </div>
  );
}

export default function TopSections({
  heroGa,
  heroGaError,
  sources,
  sourcesError,
  cioSignupsByRange,
  cioTotal,
  cioError,
  realtimeUsers,
  cioRecent,
}: Props) {
  const [range, setRange] = useState<GaRangePreset>("30d");
  const [traffic, setTraffic] = useState<GaTrafficType>("all");

  const heroRange = heroGa[range];
  const ga = heroRange ? heroRange[traffic] : null;
  const cioCount = cioSignupsByRange[traffic][range];
  const currentSources = sources[range];

  // CANONICAL DENOMINATOR: visitors (GA activeUsers) for every conversion
  // calculation across the dashboard. Sessions and page views are shown as
  // context (in the Visitors cell subtitle) but never used as the base.
  //
  //   page views  — raw page loads; refreshes count
  //   sessions    — groups of activity; 30min idle ends one
  //   visitors    — unique humans (the conversion-math base)
  //
  // Falls back to sessions only if activeUsers is missing for some reason
  // (shouldn't happen with the GA Data API but defensive for "all" range).
  const visitors =
    (ga?.activeUsers ?? 0) > 0
      ? ga!.activeUsers
      : ga?.sessions ?? 0;
  const cvr =
    cioCount != null && visitors > 0
      ? ((cioCount / visitors) * 100).toFixed(1)
      : null;

  // Recent signups table also respects the traffic filter so the team can
  // eyeball the actual people behind the numbers.
  const filteredRecent = cioRecent.filter((p) =>
    traffic === "all" ? true : p.trafficType === traffic
  );

  // Top traffic sources is itself a breakdown of all sources — filtering
  // by paid/organic would just hide rows. Show all, but label the section
  // so it's clear it doesn't respect the filter.
  const sourcesNote =
    traffic === "all" ? "by sessions" : "by sessions · all traffic";

  return (
    <>
      {/* Top toggle bar — drives every section below until the daily trend. */}
      <div className="dash-top-toggle">
        <div className="meta">Traffic</div>
        <TrafficToggle value={traffic} onChange={setTraffic} />
        <div className="meta">Window</div>
        <RangeToggle value={range} onChange={setRange} />
      </div>

      {/* Hero metrics */}
      <div className="dash-hero">
        <div className="cell">
          <div className="label">
            Waitlist Signups · {descriptiveRange(range)}
            {traffic !== "all" ? ` · ${trafficLabel(traffic).toLowerCase()}` : ""}
          </div>
          <div className="value accent">{fmt(cioCount)}</div>
          <div className="sub">
            {fmt(cioTotal)} total · Customer.io
          </div>
        </div>
        <div className="cell">
          <div className="label">
            Visitors · {descriptiveRange(range)}
            {traffic !== "all" ? ` · ${trafficLabel(traffic).toLowerCase()}` : ""}
          </div>
          <div className="value">{fmt(ga?.activeUsers ?? null)}</div>
          <div className="sub">
            {fmt(ga?.sessions ?? null)} sessions · {fmt(ga?.pageViews ?? null)} page views
          </div>
        </div>
        <div className="cell">
          <div className="label">
            Conversion · {descriptiveRange(range)}
            {traffic !== "all" ? ` · ${trafficLabel(traffic).toLowerCase()}` : ""}
          </div>
          <div className="value">{cvr ? `${cvr}%` : "—"}</div>
          <div className="sub">
            {fmt(cioCount)} signups / {fmt(visitors)} visitors
          </div>
        </div>
        <div className="cell">
          <div className="label">Active right now</div>
          <div className="value">{fmt(realtimeUsers)}</div>
          <div className="sub">Last 30 min · all traffic</div>
        </div>
      </div>

      {/* Error banners */}
      {cioError && (
        <div className="dash-error">
          <strong>Customer.io</strong>
          {cioError}
        </div>
      )}
      {heroGaError && (
        <div className="dash-error">
          <strong>GA4 — metrics</strong>
          {heroGaError}
        </div>
      )}

      {/* Two-column: sources + funnel */}
      <div className="dash-row-2">
        <section className="dash-section">
          <div className="header">
            <h2>Top traffic sources · {descriptiveRange(range)}</h2>
            <div className="meta">{sourcesNote}</div>
          </div>
          <div className="dash-source-list">
            {currentSources.length === 0 ? (
              <div className="empty" style={{ padding: 24, textAlign: "center" }}>
                {sourcesError ? sourcesError : "No data yet."}
              </div>
            ) : (
              currentSources.map((s, i) => (
                <div
                  key={`${s.source}-${s.medium}-${i}`}
                  className="dash-source-row"
                >
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
            <h2>
              Funnel · {descriptiveRange(range)}
              {traffic !== "all" ? ` · ${trafficLabel(traffic).toLowerCase()}` : ""}
            </h2>
            <div className="meta">rates as % of visitors</div>
          </div>
          <div className="body">
            <FunnelRow
              label="Visitors"
              value={visitors || null}
              base={visitors || null}
            />
            <FunnelRow
              label="Form starts"
              value={ga?.formStarts ?? null}
              base={visitors || null}
            />
            <FunnelRow
              label="Waitlist signups"
              value={cioCount ?? null}
              base={visitors || null}
              accent
            />
            <FunnelRow
              label="Scroll events"
              value={ga?.scrolls ?? null}
              base={visitors || null}
              subtle
            />
          </div>
        </section>
      </div>

      {/* Recent signups — filtered by traffic toggle, slid up here from the
          bottom of the page so the filter is visually contiguous with it. */}
      <section className="dash-section">
        <div className="header">
          <h2>
            Recent signups · last 20
            {traffic !== "all" ? ` · ${trafficLabel(traffic).toLowerCase()}` : ""}
          </h2>
          <div className="meta">Customer.io</div>
        </div>
        <div className="dash-table-wrap">
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
              {filteredRecent.length === 0 ? (
                <tr>
                  <td className="empty" colSpan={4}>
                    {cioError
                      ? cioError
                      : traffic === "all"
                      ? "No signups yet."
                      : `No ${trafficLabel(traffic).toLowerCase()} signups yet.`}
                  </td>
                </tr>
              ) : (
                filteredRecent.map((p) => (
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
        </div>
      </section>
    </>
  );
}

function SourceCell({ person }: { person: WaitlistPerson }) {
  // Top line: source channel. utm_source (paid/social) > "referral" > "direct".
  const primary =
    person.utmSource || (person.referredBy ? "referral" : null) || "direct";

  // Stacked detail lines beneath the source. Meta's URL-parameter convention
  // maps utm_campaign->campaign, utm_term->adset, utm_content->ad name.
  const detail: Array<{ label: string; value: string }> = [];
  if (person.utmCampaign) detail.push({ label: "camp", value: person.utmCampaign });
  if (person.utmTerm) detail.push({ label: "adset", value: person.utmTerm });
  if (person.utmContent) detail.push({ label: "ad", value: person.utmContent });
  if (detail.length === 0 && person.referredBy) {
    detail.push({ label: "ref", value: person.referredBy.slice(0, 8) });
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
      <span style={{ color: "var(--ink)" }}>{primary}</span>
      {detail.map((d) => (
        <span
          key={d.label}
          style={{ color: "var(--ink-mute)", fontSize: 11, letterSpacing: 0.3 }}
        >
          <span style={{ opacity: 0.65, marginRight: 6 }}>{d.label}</span>
          {truncate(d.value, 44)}
        </span>
      ))}
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
