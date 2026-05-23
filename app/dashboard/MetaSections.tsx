"use client";

import { useState } from "react";
import type { MetaInsight, MetaCampaign, MetaAd, RangePreset } from "@/lib/meta";

interface Props {
  spend: Record<RangePreset, MetaInsight | null>;
  campaigns: Record<RangePreset, MetaCampaign[]>;
  ads: Record<RangePreset, MetaAd[]>;
  spendError?: string;
  campaignsError?: string;
  adsError?: string;
}

const WINDOWS: RangePreset[] = ["24h", "7d", "30d", "all"];

function labelFor(w: RangePreset): string {
  return w === "24h" ? "24h" : w === "7d" ? "7d" : w === "30d" ? "30d" : "All";
}

function descriptiveLabel(w: RangePreset): string {
  return w === "24h"
    ? "last 24h"
    : w === "7d"
    ? "last 7d"
    : w === "30d"
    ? "last 30d"
    : "all time";
}

function fmt(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n)) return "—";
  return Number(n).toLocaleString("en-US");
}

function money(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n)) return "—";
  return `$${Number(n).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function pct(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n)) return "—";
  return `${Number(n).toFixed(2)}%`;
}

function truncate(s: string, max: number): string {
  if (s.length <= max) return s;
  return s.slice(0, max - 1) + "…";
}

function RangeToggle({
  value,
  onChange,
}: {
  value: RangePreset;
  onChange: (v: RangePreset) => void;
}) {
  return (
    <div className="range-toggle">
      {WINDOWS.map((w) => (
        <button
          key={w}
          type="button"
          className={`range-toggle-btn${w === value ? " active" : ""}`}
          onClick={() => onChange(w)}
        >
          {labelFor(w)}
        </button>
      ))}
    </div>
  );
}

export default function MetaSections({
  spend,
  campaigns,
  ads,
  spendError,
  campaignsError,
  adsError,
}: Props) {
  const [range, setRange] = useState<RangePreset>("24h");
  const currentSpend = spend[range];
  const currentCampaigns = campaigns[range];
  const currentAds = ads[range];

  const numStyle = {
    textAlign: "right" as const,
    fontVariantNumeric: "tabular-nums" as const,
  };

  return (
    <>
      {/* Meta ad spend hero */}
      <section className="dash-section">
        <div className="header">
          <h2>Meta ad spend · {descriptiveLabel(range)}</h2>
          <RangeToggle value={range} onChange={setRange} />
        </div>
        {spendError ? (
          <div className="empty" style={{ padding: 24, textAlign: "center" }}>
            {spendError}
          </div>
        ) : (
          <div className="dash-hero cols-5" style={{ border: 0, margin: 0 }}>
            <div className="cell">
              <div className="label">Spend</div>
              <div className="value">{money(currentSpend?.spend ?? null)}</div>
              <div className="sub">{fmt(currentSpend?.leads ?? null)} leads</div>
            </div>
            <div className="cell">
              <div className="label">CPL</div>
              <div className="value">{money(currentSpend?.costPerLead ?? null)}</div>
              <div className="sub">spend / leads</div>
            </div>
            <div className="cell">
              <div className="label">CTR</div>
              <div className="value">{pct(currentSpend?.ctr ?? null)}</div>
              <div className="sub">
                {fmt(currentSpend?.clicks ?? null)} clicks /{" "}
                {fmt(currentSpend?.impressions ?? null)} impr
              </div>
            </div>
            <div className="cell">
              <div className="label">CPM</div>
              <div className="value">{money(currentSpend?.cpm ?? null)}</div>
              <div className="sub">CPC {money(currentSpend?.cpc ?? null)}</div>
            </div>
            <div className="cell">
              <div className="label">Leads</div>
              <div className="value accent">{fmt(currentSpend?.leads ?? null)}</div>
              <div className="sub">
                Meta-reported · check CIO for actual signups
              </div>
            </div>
          </div>
        )}
      </section>

      {/* Top campaigns */}
      <section className="dash-section">
        <div className="header">
          <h2>Top campaigns · {descriptiveLabel(range)}</h2>
          <div className="meta">by leads</div>
        </div>
        <div className="dash-table-wrap">
        <table className="dash-table">
          <thead>
            <tr>
              <th>Campaign</th>
              <th style={numStyle}>Spend</th>
              <th style={numStyle}>Leads</th>
              <th style={numStyle}>CPL</th>
              <th style={numStyle}>CTR</th>
            </tr>
          </thead>
          <tbody>
            {currentCampaigns.length === 0 ? (
              <tr>
                <td className="empty" colSpan={5}>
                  {campaignsError
                    ? campaignsError
                    : `No campaign data for ${descriptiveLabel(range)}.`}
                </td>
              </tr>
            ) : (
              currentCampaigns.map((c) => (
                <tr key={c.id}>
                  <td>{truncate(c.name, 56)}</td>
                  <td className="source" style={numStyle}>
                    {money(c.spend)}
                  </td>
                  <td className="source" style={numStyle}>
                    {fmt(c.leads)}
                  </td>
                  <td className="source" style={numStyle}>
                    {money(c.costPerLead)}
                  </td>
                  <td className="source" style={numStyle}>
                    {pct(c.ctr)}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
        </div>
      </section>

      {/* Top ads */}
      <section className="dash-section">
        <div className="header">
          <h2>Top ad creatives · {descriptiveLabel(range)}</h2>
          <div className="meta">by leads</div>
        </div>
        <div className="dash-table-wrap">
        <table className="dash-table">
          <thead>
            <tr>
              <th>Ad</th>
              <th style={numStyle}>Spend</th>
              <th style={numStyle}>Impr</th>
              <th style={numStyle}>CTR</th>
              <th style={numStyle}>Leads</th>
              <th style={numStyle}>CPL</th>
            </tr>
          </thead>
          <tbody>
            {currentAds.length === 0 ? (
              <tr>
                <td className="empty" colSpan={6}>
                  {adsError
                    ? adsError
                    : `No ad data for ${descriptiveLabel(range)}.`}
                </td>
              </tr>
            ) : (
              currentAds.map((a) => (
                <tr key={a.id}>
                  <td>{truncate(a.name, 50)}</td>
                  <td className="source" style={numStyle}>
                    {money(a.spend)}
                  </td>
                  <td className="source" style={numStyle}>
                    {fmt(a.impressions)}
                  </td>
                  <td className="source" style={numStyle}>
                    {pct(a.ctr)}
                  </td>
                  <td className="source" style={numStyle}>
                    {fmt(a.leads)}
                  </td>
                  <td className="source" style={numStyle}>
                    {money(a.costPerLead)}
                  </td>
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
