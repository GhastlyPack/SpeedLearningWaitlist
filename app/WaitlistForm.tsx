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
  }
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

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

    try {
      if (typeof window !== "undefined" && window.cioanalytics) {
        const nowIso = new Date().toISOString();
        const traits: Traits = {
          email: cleanEmail,
          first_name: cleanFirst,
          waitlist_signed_up_at: nowIso,
          waitlist_source: "speedlearning.com",
        };
        if (cleanLast) traits.last_name = cleanLast;

        window.cioanalytics.identify(cleanEmail, traits);
        window.cioanalytics.track("waitlist_signup", {
          source: "speedlearning.com",
          signed_up_at: nowIso,
          has_last_name: Boolean(cleanLast),
        });
      } else if (process.env.NODE_ENV !== "production") {
        console.warn(
          "[waitlist] cioanalytics not loaded — snippet hasn't initialized yet."
        );
      }

      setStatus("success");
      setMessage(
        `You're on the list, ${cleanFirst}. We'll be in touch.`
      );
      setFirstName("");
      setLastName("");
      setEmail("");
    } catch {
      setStatus("error");
      setMessage("Something went wrong. Try again in a moment.");
    }
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
            placeholder="Alex"
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
            placeholder="Pell"
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
            placeholder="you@domain.com"
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
