# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm install          # one-time
npm run dev          # dev server on :3000 (Turbopack)
npm run build        # production build
npm run start        # serve the build
npm run lint         # next lint
npx tsc --noEmit     # typecheck without building — fastest sanity check before commit
```

There is no test framework wired up. The "tests" are `npx tsc --noEmit` plus `npx next build` (which catches many runtime issues via type collection and route generation).

For local CIO/GA/Meta data to actually flow, set the corresponding env vars in `.env.local`. Without them, the API routes are silent no-ops (return `ok: false`) so dev doesn't blow up. `.env.example` is the authoritative list.

## The two surfaces

**One Next.js app serves two distinct domains** via `middleware.ts` (Edge runtime):

- `speedlearning.com` — public marketing lander + waitlist form (`app/page.tsx`, `app/WaitlistForm.tsx`)
- `dash.speedlearning.com` — internal team dashboard, rewritten to `/dashboard/*` and gated by Basic Auth (`DASHBOARD_PASSWORD`)

`app/layout.tsx` is shared, but **GA, Meta Pixel, and any other marketing trackers are conditionally injected** based on `host.startsWith("dash.")` — the dashboard subdomain must never pollute the conversion data it's reporting on. If you add any third-party browser script that produces analytics events, gate it the same way.

## Signup data flow

The form (`app/WaitlistForm.tsx`) fires three things in parallel on a successful submit:

1. **GA4 `waitlist_signup` event** (browser, via `gtag`)
2. **`POST /api/cio-track`** — server-side write to Customer.io's Track API (PUT customer traits + POST `waitlist_signup` event). **This is the canonical source of truth for signups.** The browser `cioanalytics` CDP snippet was removed on 2026-05-21 after a CDP→Journeys outage cost us ~30 in-person QR-code signups; everything goes through the server route now.
3. **`POST /api/meta-capi`** — Meta Conversions API, sole source of the `Lead` event. We deliberately do **not** fire `fbq('track', 'Lead', ...)` from the browser anymore (Meta wasn't reliably deduplicating despite matching `event_id`s — we hit "Additional conversions reported from the Conversions API" in Meta diagnostics). The browser Pixel still loads and fires `PageView` automatically for Custom Audiences / retargeting.

CIO `email` is the customer `id`. UTM/fbclid/referrer attribution is first-touched into a `_sl_utm` cookie (`lib/utms.ts`, mounted via `app/UtmCapture.tsx`) and forwarded with the signup so segments and dashboard attribution work.

## Internal-email filter

Anyone signing up with an `@bowskyventures.com` email (see `lib/internal.ts`, `INTERNAL_DOMAINS`):

- Skips GA `waitlist_signup`, Meta Pixel, and Meta CAPI fires (`WaitlistForm.tsx` checks `isInternalEmail`)
- Still hits `/api/cio-track` (so the team can verify the confirmation email flow end-to-end)
- Is tagged `internal: true` in CIO and **filtered out of every dashboard count** in `lib/cio.ts`'s `getWaitlistSummary`

If a team member uses a non-`@bowskyventures.com` email for testing, they'll pollute metrics. Either add their domain to `INTERNAL_DOMAINS` or flip `internal: true` on the CIO record manually.

## Paid vs Organic classification

Two-tier filter across the dashboard. Resolution order in `lib/cio.ts`'s `getCustomerByCioId`:

1. **`NAME_TRAFFIC_OVERRIDES`** (hardcoded in `lib/cio.ts`) — for pre-tracking ad signups that landed without UTMs. Matched case-insensitively by `first_name + last_name`. Add to this list when historical records get mis-classified.
2. **Stored CIO `traffic_type` attribute** — written by `/api/cio-track` on every new signup and by `/api/backfill-traffic` for existing records. Flipping this attribute in CIO's admin UI propagates to the dashboard.
3. **Computed from `utm_medium` + `fbclid`** (`classifyCioTraffic`) — fallback. Paid mediums are `paid_social`, `cpc`, `ppc`, `paid_search`, `display`, `paid`, OR `fbclid` is present.

GA side classifies via `sessionDefaultChannelGroup` (paid = anything starting with "Paid", "Display", or "Cross-network"). Both sides line up so paid/organic comparisons stay coherent across data sources.

## Dashboard architecture (`app/dashboard/`)

- **`page.tsx`** — server component. Fires all data fetches in one `Promise.allSettled` and passes results down. Owns layout (topbar, daily trend chart, footer).
- **`TopSections.tsx`** — client component. Owns the two top-level toggles (Window: 24h/7d/30d/All × Traffic: All/Paid/Organic) and renders everything driven by them: Hero, Top traffic sources, Funnel, Recent signups. All-ranges-pre-fetched + client-toggle pattern (NOT URL search params).
- **`MetaSections.tsx`** — client component with its own Window toggle for Meta-specific sections (ad spend, top campaigns, top ad creatives). Same pattern.
- **`SignupPoller.tsx`** — invisible client component. Polls `/api/latest-signup` every 30s; calls `router.refresh()` when CIO waitlist count goes up. Pauses while the tab is hidden, re-checks on `visibilitychange`.

### Conventions you must preserve

- **Visitors (GA `activeUsers`) is the canonical denominator** for every conversion-rate calculation. Hero "Conversion" and Funnel "Waitlist signups %" must produce the same number. Do not mix in `sessions` or `pageViews` as bases without a comment explaining why.
- **GA queries bundle ranges via `dateRanges`** to fit within GA's 10-concurrent-request quota. `getHeroMetrics` and `getTrafficSources` accept an array of presets and fan out into a single multi-range call each. Use the `dimIdx` helper to parse the implicit `dateRange` dimension GA tacks onto multi-range responses. Don't add a new GA function that issues per-range queries in a loop.
- **`activeUsers` doesn't sum across channel-group rows** (a returning user shows in both paid and organic buckets but only once overall). The "all" bucket in `getHeroMetrics` comes from a separate unsegmented sub-query for this reason. Don't refactor it to sum paid + organic.
- **The 30-day daily trend chart in `page.tsx` is deliberately not filtered by the traffic toggle.** It's a long time-series of overall growth.

### Range / traffic-type vocabulary

`GaRangePreset = "24h" | "7d" | "30d" | "all"` lives in `lib/ga.ts` and matches the Meta side's `RangePreset` in `lib/meta.ts`. "24h" means yesterday+today (rolling-ish, robust to GA timezone slop and Meta's ~45-min ingest delay). `GaTrafficType = "paid" | "organic" | "all"` lives in `lib/ga.ts`.

## API routes

All under `app/api/`:

- `cio-track` — public POST from the lander form. Writes signup to CIO via Track API, also classifies `traffic_type` and writes it.
- `meta-capi` — public POST from the lander form. Sole source of the Meta `Lead` event (server-side dedup via per-submit `event_id` UUID, kept as a future-proofing idempotency token even though we don't have a browser pair anymore).
- `latest-signup` — public GET. Returns the count of CIO waitlist=true identifiers in the first search page. Cheap (no per-customer hydration). Used by `SignupPoller`.
- `backfill-traffic` — POST guarded by `Authorization: Bearer DASHBOARD_PASSWORD`. One-shot: walks every CIO waitlist person and PUTs the computed `traffic_type` back. Idempotent.

## Libraries (`lib/`)

Pure data clients — no React, no Next.js specifics:

- `ga.ts` — GA4 Data API via `@google-analytics/data`. Multi-range queries, channel-group bucketing, realtime, daily trend.
- `cio.ts` — Customer.io App API (read side) + traffic classification. `getWaitlistSummary` is the dashboard's single entry point for everything CIO-derived; it filters internal, applies overrides, and produces both raw and traffic-split daily/total counts.
- `meta.ts` — Meta Marketing API. Action-type priority list (`lead` → `onsite_web_lead` → ...) so we never sum overlapping action_type buckets (which would double-count). See the comments in `leadsFromActions` if you find yourself adjusting lead counts.
- `internal.ts` — `INTERNAL_DOMAINS` + `isInternalEmail`.
- `utms.ts` — first-touch UTM cookie capture, idempotent.

## Style system

No CSS framework. Design tokens (`--ink`, `--ax`, `--paper`, `--rule`, etc.) live in `app/globals.css` and are reused by `app/dashboard/dashboard.css`. Fonts come from `next/font/google` (IBM Plex Sans + JetBrains Mono + Newsreader). When adding new UI, use the existing tokens rather than introducing colors.

## Lander variants (`/v/<slug>`)

10 alternative lander designs live under `app/v/<slug>/page.tsx` for a conversion test. Each variant:
- Shares `WaitlistForm` (passes its own slug via the `variant` prop)
- Writes `variant: <slug>` as a CIO attribute via `/api/cio-track`
- Falls under the same global layout (GA, Meta Pixel, UTM capture all apply)
- Owns its own visual identity — `app/v/layout.tsx` is intentionally a pass-through

The registry is `lib/variants.ts`. `resolveVariantSlug` validates incoming slugs server-side so a client can't write garbage strings as `variant` on CIO records. Unknown / missing → `"control"` (the root lander). The control lander at `app/page.tsx` explicitly passes `variant="control"` to its `WaitlistForm`.

`app/v/page.tsx` is an internal `noindex` index of all variants for team browsing.

## UI/UX Pro Max skill (`.claude/skills/ui-ux-pro-max/`)

A Python-based Claude Code skill for design intelligence — color palettes, font pairings, style catalogs, UX rule database, and a reasoning engine that emits a coherent design system for a given product type. Used while building lander variants. Requires Python 3.

```bash
# Generate a design system for a new variant
python3 .claude/skills/ui-ux-pro-max/scripts/search.py "<product keywords> <style hint>" --design-system -p "<variant name>"

# Search a specific dimension
python3 .claude/skills/ui-ux-pro-max/scripts/search.py "<keywords>" --domain style
python3 .claude/skills/ui-ux-pro-max/scripts/search.py "<keywords>" --domain color
```

Not a runtime dep — purely an authoring tool. Safe to delete the skill folder once the conversion test concludes if we don't keep iterating on variants.

## Deploy

Vercel auto-deploys `main` on push to `github.com/GhastlyPack/SpeedLearningWaitlist`. Two domains attached: `speedlearning.com` (apex + `www`) and `dash.speedlearning.com`. Env vars are managed in Vercel → Settings → Environment Variables; secrets are marked Sensitive. See `.env.example` for the full list and `README.md` for the wiring playbook (GA service account, CIO API keys, Meta tokens, etc.).
