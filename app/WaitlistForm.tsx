"use client";

import { useState } from "react";

type Status = "idle" | "submitting" | "success" | "error";

// Customer.io CDP / Data Pipelines (cioanalytics) — Segment-compatible API.
type Traits = Record<string, unknown>;
interface CioAnalytics {
  identify: (userId: string, traits?: Traits) => void;
  track: (event: string, properties?: Traits) => void;
  page: (name?: string, properties?: Traits) => void;
}

declare global {
  interface Window {
    cioanalytics?: CioAnalytics;
    fbq?: (...args: unknown[]) => void;
    gtag?: (...args: unknown[]) => void;
    dataLayer?: unknown[];
  }
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function readCookie(name: string): string | undefined {
  if (typeof document === "undefined") return undefined;
  const match = document.cookie.match(
    new RegExp("(^|; )" + name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "=([^;]*)")
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

export default function WaitlistForm() {
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const [message, setMessage] = useState<string>("");

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

    // -- Customer.io (CDP / cioanalytics) -----------------------------------
    try {
      if (typeof window !== "undefined" && window.cioanalytics) {
        const traits: Traits = {
          email: cleanEmail,
          first_name: cleanFirst,
          waitlist: true,
          waitlist_signed_up_at: nowIso,
          waitlist_source: "speedlearning.com",
        };
        if (cleanLast) traits.last_name = cleanLast;

        window.cioanalytics.identify(cleanEmail, traits);
        window.cioanalytics.track("waitlist_signup", {
          source: "speedlearning.com",
          signed_up_at: nowIso,
        });
      } else if (process.env.NODE_ENV !== "production") {
        console.warn(
          "[waitlist] cioanalytics not loaded — snippet hasn't initialized yet."
        );
      }
    } catch (err) {
      // Non-fatal: a tracker hiccup shouldn't block the success state.
      if (process.env.NODE_ENV !== "production") {
        console.warn("[waitlist] cioanalytics call threw", err);
      }
    }

    // -- Google Analytics 4 (gtag.js) — fires the "waitlist_signup" key event
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

    // -- Meta Pixel (browser) — fires the "Lead" standard event -------------
    try {
      if (typeof window !== "undefined" && window.fbq) {
        window.fbq(
          "track",
          "Lead",
          {
            content_name: "SpeedLearning Waitlist",
            value: 0,
            currency: "USD",
          },
          { eventID: eventId }
        );
      } else if (process.env.NODE_ENV !== "production") {
        console.warn(
          "[waitlist] fbq not loaded — Meta Pixel snippet hasn't initialized yet."
        );
      }
    } catch (err) {
      if (process.env.NODE_ENV !== "production") {
        console.warn("[waitlist] fbq call threw", err);
      }
    }

    // -- Meta CAPI (server) — fire-and-forget, deduped via eventID ----------
    if (typeof window !== "undefined") {
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
        // Browser pixel already covered the event; server fallback failure
        // is acceptable. We don't surface this to the user.
      });
    }

    setStatus("success");
    setMessage(`You're on the list, ${cleanFirst}. We'll be in touch.`);
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
    </div>
  );
}
