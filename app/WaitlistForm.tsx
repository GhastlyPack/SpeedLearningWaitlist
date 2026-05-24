"use client";

import { useState } from "react";
import { getStoredUtms } from "@/lib/utms";
import { isInternalEmail } from "@/lib/internal";
import ShareButtons from "./ShareButtons";

type Status = "idle" | "submitting" | "success" | "error";

declare global {
  interface Window {
    fbq?: (...args: unknown[]) => void;
    gtag?: (...args: unknown[]) => void;
    dataLayer?: unknown[];
  }
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function readCookie(name: string): string | undefined {
  if (typeof document === "undefined") return undefined;
  const match = document.cookie.match(
    new RegExp(
      "(^|; )" + name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "=([^;]*)"
    )
  );
  return match ? decodeURIComponent(match[2]) : undefined;
}

function newEventId(): string {
  if (
    typeof crypto !== "undefined" &&
    typeof crypto.randomUUID === "function"
  ) {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

interface WaitlistFormProps {
  /**
   * Which lander variant the form is being rendered inside. Passed straight
   * through to /api/cio-track and stored as a CIO attribute so the dashboard
   * can break down signups by variant. Defaults to "control" — the canonical
   * lander at speedlearning.com/.
   */
  variant?: string;
}

export default function WaitlistForm({ variant = "control" }: WaitlistFormProps = {}) {
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const [message, setMessage] = useState<string>("");
  const [referralCode, setReferralCode] = useState<string | null>(null);
  const [submittedFirstName, setSubmittedFirstName] = useState<string>("");

  const clearError = () => {
    if (status === "error") {
      setStatus("idle");
      setMessage("");
    }
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanFirst = firstName.trim();
    const cleanLast = lastName.trim();
    const cleanEmail = email.trim().toLowerCase();

    if (!cleanFirst) {
      setStatus("error");
      setMessage("Please enter your first name.");
      return;
    }
    if (!EMAIL_RE.test(cleanEmail)) {
      setStatus("error");
      setMessage("That doesn't look like a valid email.");
      return;
    }

    setStatus("submitting");
    setMessage("");

    const nowIso = new Date().toISOString();
    const eventId = newEventId();
    const utms = getStoredUtms();

    // Internal team emails (@bowskyventures.com etc.) bypass ad-platform &
    // analytics events entirely so test signups don't inflate Meta lead
    // counts or GA conversions. They still flow through /api/cio-track so
    // the team can test the confirmation email end-to-end.
    const internal = isInternalEmail(cleanEmail);

    // -- Google Analytics 4 (gtag.js) — fires the "waitlist_signup" key event
    if (!internal) {
      try {
        if (typeof window !== "undefined" && typeof window.gtag === "function") {
          window.gtag("event", "waitlist_signup", {
            value: 0,
            currency: "USD",
            method: "email_form",
          });
        } else if (process.env.NODE_ENV !== "production") {
          console.warn(
            "[waitlist] gtag not loaded — GA4 snippet hasn't initialized yet."
          );
        }
      } catch (err) {
        if (process.env.NODE_ENV !== "production") {
          console.warn("[waitlist] gtag call threw", err);
        }
      }
    }

    // Meta Lead event is fired SERVER-SIDE only via /api/meta-capi below.
    // We intentionally do not fire fbq('track', 'Lead', ...) from the browser:
    // running both sides with eventID-based dedup is the documented best
    // practice, but in practice it leaves room for double-counting whenever
    // dedup misfires (event_id mismatch, late arrival, etc). CAPI-only
    // guarantees exactly one Lead event per signup, survives ad blockers,
    // and ships strong match keys (hashed email + IP + UA + fbp/fbc).
    // The browser Pixel still fires PageView automatically (initialized in
    // layout.tsx), which keeps Custom Audiences / retargeting working.

    // -- Meta CAPI (server) — sole source of the Lead event ----------------
    if (!internal && typeof window !== "undefined") {
      const fbp = readCookie("_fbp");
      const fbc = readCookie("_fbc");
      void fetch("/api/meta-capi", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          event_id: eventId,
          email: cleanEmail,
          first_name: cleanFirst,
          last_name: cleanLast || undefined,
          fbp,
          fbc,
          event_source_url: window.location.href,
        }),
        keepalive: true,
      }).catch(() => {
        /* same-origin route — failures land in Vercel logs */
      });
    }

    // -- Customer.io (server-side Track API at /api/cio-track) --------------
    // Browser snippet was removed 2026-05-21 after data loss incident. All
    // CIO writes go through this server route now. Includes UTM attribution
    // from the cookie captured on first visit.
    if (typeof window !== "undefined") {
      void fetch("/api/cio-track", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: cleanEmail,
          first_name: cleanFirst,
          last_name: cleanLast || undefined,
          source: "speedlearning.com",
          signed_up_at: nowIso,
          // Which lander variant this signup came from. "control" for the
          // root /, otherwise the variant slug (e.g. "brutalist", "glass").
          variant,
          // First-touch acquisition attributes, if present:
          utm_source: utms.utm_source,
          utm_medium: utms.utm_medium,
          utm_campaign: utms.utm_campaign,
          utm_content: utms.utm_content,
          utm_term: utms.utm_term,
          fbclid: utms.fbclid,
          gclid: utms.gclid,
          ref: utms.ref,
          referrer: utms.referrer,
          landing_page: utms.landing_page,
        }),
        keepalive: true,
      })
        .then((res) => res.ok ? res.json() : null)
        .then((data) => {
          if (data && typeof data === "object" && "referral_code" in data) {
            setReferralCode((data as { referral_code?: string }).referral_code ?? null);
          }
        })
        .catch(() => {
          /* server route, same-origin */
        });
    }

    setStatus("success");
    setSubmittedFirstName(cleanFirst);
    setMessage(
      `You're on the list, ${cleanFirst}. Watch your inbox for next steps.`
    );
    setFirstName("");
    setLastName("");
    setEmail("");
  };

  const metaClass =
    status === "error"
      ? "form-meta error"
      : status === "success"
      ? "form-meta success"
      : "form-meta";

  const locked = status === "submitting" || status === "success";

  return (
    <div>
      <form className="form" onSubmit={submit} noValidate>
        <label className="field">
          <span className="field-label">First name</span>
          <input
            type="text"
            autoComplete="given-name"
            placeholder="Richard"
            value={firstName}
            onChange={(e) => {
              setFirstName(e.target.value);
              clearError();
            }}
            required
            disabled={locked}
            aria-label="First name"
          />
        </label>

        <label className="field">
          <span className="field-label">
            Last name <span className="field-label-meta">· Optional</span>
          </span>
          <input
            type="text"
            autoComplete="family-name"
            placeholder="Hendricks"
            value={lastName}
            onChange={(e) => setLastName(e.target.value)}
            disabled={locked}
            aria-label="Last name (optional)"
          />
        </label>

        <label className="field">
          <span className="field-label">Email</span>
          <input
            type="email"
            inputMode="email"
            autoComplete="email"
            placeholder="richard@piedpiper.com"
            value={email}
            onChange={(e) => {
              setEmail(e.target.value);
              clearError();
            }}
            required
            disabled={locked}
            aria-label="Email address"
          />
        </label>

        <button type="submit" disabled={locked}>
          {status === "submitting"
            ? "Joining…"
            : status === "success"
            ? "Joined"
            : "Join the waitlist"}
        </button>
      </form>
      <div className={metaClass} aria-live="polite">
        {message ||
          "Early access, updates, and the occasional offer. Unsubscribe anytime."}
      </div>

      {status === "success" && (
        <ShareButtons
          referralCode={referralCode}
          prompt={`${submittedFirstName ? submittedFirstName + ", " : ""}share with friends and earn credits when they join.`}
        />
      )}
    </div>
  );
}
