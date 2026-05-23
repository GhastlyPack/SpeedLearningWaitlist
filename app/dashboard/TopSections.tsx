"use client";

import { useState } from "react";
import type { GaRangePreset, HeroMetrics, TrafficSource } from "@/lib/ga";

interface Props {
  heroGa: Record<GaRangePreset, HeroMetrics | null>;
  heroGaError?: string;
  sources: Record<GaRangePreset, TrafficSource[]>;
  sourcesError?: string;
  /** CIO signup totals bucketed by the same range presets so the
   *  "Waitlist Signups" cell and "Conversion" math line up with the toggle. */
  cioSignupsByRange: Record<GaRangePreset, number>;
  cioTotal: number | null;
  cioError?: string;
  realtimeUsers: number | null;
}

const RANGES: GaRangePreset[] = ["24h", "7d", "30d", "all"];

function labelFor(r: GaRangePreset): string {
  return r === "24h" ? "24h" : r === "7d" ? "7d" : r === "30d" ? "30d" : "All";
}

function descriptiveLabel(r: GaRangePreset): string {
  return r === "24h"
    ? "last 24h"
    : r === "7d"
    ? "last 7d"
    : r === "30d"
    ? "last 30d"
    : "all time";
}

function fmt(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n)) return "—";
  return Number(n).toLocaleString("en-US");
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
          {labelFor(r)}
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
}: Props) {
  const [range, setRange] = useState<GaRangePreset>("30d");
  const ga = heroGa[range];
  const cioCount = cioSignupsByRange[range];
  const currentSources = sources[range];

  // Conversion-rate math. CIO is the canonical signup count; GA active
  // users is the closest GA proxy for "unique humans on the lander."
  const visitors =
    (ga?.activeUsers ?? 0) > 0
      ? ga!.activeUsers
      : ga?.sessions ?? 0;
  const cvr =
    cioCount != null && visitors > 0
      ? ((cioCount / visitors) * 100).toFixed(1)
      : null;

  return (
    <>
      {/* Range toggle bar — anchors the whole top section */}
      <div className="dash-top-toggle">
        <div className="meta">Window</div>
        <RangeToggle value={range} onChange={setRange} />
      </div>

      {/* Hero metrics */}
      <div className="dash-hero">
        <div className="cell">
          <div className="label">Waitlist Signups · {descriptiveLabel(range)}</div>
          <div className="value accent">{fmt(cioCount)}</div>
          <div className="sub">
            {fmt(cioTotal)} total · Customer.io
          </div>
        </div>
        <div className="cell">
          <div className="label">Sessions · {descriptiveLabel(range)}</div>
          <div className="value">{fmt(ga?.sessions ?? null)}</div>
          <div className="sub">Page views: {fmt(ga?.pageViews ?? null)}</div>
        </div>
        <div className="cell">
          <div className="label">Conversion · {descriptiveLabel(range)}</div>
          <div className="value">{cvr ? `${cvr}%` : "—"}</div>
          <div className="sub">
            {fmt(cioCount)} signups / {fmt(visitors)} visitors
          </div>
        </div>
        <div className="cell">
          <div className="label">Active right now</div>
          <div className="value">{fmt(realtimeUsers)}</div>
          <div className="sub">Last 30 min</div>
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
            <h2>Top traffic sources · {descriptiveLabel(range)}</h2>
            <div className="meta">by sessions</div>
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
            <h2>Funnel · {descriptiveLabel(range)}</h2>
            <div className="meta">GA4 events</div>
          </div>
          <div className="body">
            <FunnelRow
              label="Page views"
              value={ga?.pageViews ?? null}
              base={ga?.pageViews ?? null}
            />
            <FunnelRow
              label="Form starts"
              value={ga?.formStarts ?? null}
              base={ga?.pageViews ?? null}
            />
            <FunnelRow
              label="Waitlist signups"
              value={cioCount ?? null}
              base={ga?.pageViews ?? null}
              accent
            />
            <FunnelRow
              label="Scroll events"
              value={ga?.scrolls ?? null}
              base={ga?.pageViews ?? null}
              subtle
            />
          </div>
        </section>
      </div>
    </>
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
