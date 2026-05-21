"use client";

import { useState } from "react";

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

    // -- Customer.io (server-side Track API at /api/cio-track) --------------
    // Browser snippet was removed 2026-05-21: it got blocked by ad blockers
    // and the CDP -> Journeys destination silently dropped events. Server-side
    // Track API writes directly to Journeys with no middlewares involved.
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
        }),
        keepalive: true,
      }).catch(() => {
        // Server-side route. Same-origin, no extension can touch it. If it
        // does fail, the request lands in Vercel logs anyway as a recovery
        // breadcrumb (we console.log the email server-side).
      });
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
