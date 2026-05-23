/**
 * Client-side UTM + acquisition cookie helpers.
 *
 * First-touch attribution: we capture utm_*, fbclid, gclid, referrer, and
 * landing_page on the first visit (with any of those params) and freeze them
 * in a cookie for 30 days. Subsequent visits don't overwrite — preserves
 * the original acquisition source even if the user revisits later via
 * direct or a different campaign.
 *
 * On form submit, the stored UTMs ride along to /api/cio-track and end up
 * as attributes on the Customer.io person record. Lets us see in the
 * dashboard "this person signed up from campaign X, ad variant Y."
 */

const COOKIE = "_sl_utm";
const TTL_DAYS = 30;

// Channels we explicitly capture. Anything else in the URL is ignored.
const PARAMS = [
  "utm_source",
  "utm_medium",
  "utm_campaign",
  "utm_content",
  "utm_term",
  "fbclid",
  "gclid",
  "ref",
] as const;

export type UtmFields = Partial<Record<(typeof PARAMS)[number], string>> & {
  referrer?: string;
  landing_page?: string;
  captured_at?: string;
};

function readCookie(name: string): string | undefined {
  if (typeof document === "undefined") return undefined;
  const match = document.cookie.match(
    new RegExp(
      "(^|; )" + name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "=([^;]*)"
    )
  );
  return match ? decodeURIComponent(match[2]) : undefined;
}

function writeCookie(name: string, value: string, days: number) {
  if (typeof document === "undefined") return;
  const maxAge = days * 24 * 60 * 60;
  document.cookie = `${name}=${encodeURIComponent(
    value
  )}; path=/; max-age=${maxAge}; SameSite=Lax`;
}

/**
 * Capture URL params into a cookie on the first qualifying visit.
 * Idempotent: subsequent visits don't overwrite.
 */
export function captureUtmsFromUrl(): void {
  if (typeof window === "undefined") return;

  // First-touch: bail if already captured.
  if (readCookie(COOKIE)) return;

  const url = new URL(window.location.href);
  const captured: UtmFields = {};

  for (const key of PARAMS) {
    const v = url.searchParams.get(key);
    if (v) captured[key] = v;
  }

  // Always include landing_page so we know which entry point they hit.
  captured.landing_page = url.pathname + url.search;

  // Referrer if present and not same-origin (filters out internal navigation).
  if (document.referrer) {
    try {
      const refUrl = new URL(document.referrer);
      if (refUrl.host !== url.host) {
        captured.referrer = document.referrer;
      }
    } catch {
      // Malformed referrer — skip.
    }
  }

  captured.captured_at = new Date().toISOString();

  // Only write if at least one tracking param OR a non-empty external referrer.
  const hasTracking =
    PARAMS.some((k) => captured[k]) || !!captured.referrer;
  if (!hasTracking) return;

  writeCookie(COOKIE, JSON.stringify(captured), TTL_DAYS);
}

/**
 * Read the stored UTM cookie. Returns {} if none.
 */
export function getStoredUtms(): UtmFields {
  const raw = readCookie(COOKIE);
  if (!raw) return {};
  try {
    return JSON.parse(raw) as UtmFields;
  } catch {
    return {};
  }
}
