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
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const [message, setMessage] = useState<string>("");

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = email.trim().toLowerCase();

    if (!EMAIL_RE.test(trimmed)) {
      setStatus("error");
      setMessage("That doesn't look like a valid email.");
      return;
    }

    setStatus("submitting");
    setMessage("");

    try {
      if (typeof window !== "undefined" && window.cioanalytics) {
        const nowIso = new Date().toISOString();
        window.cioanalytics.identify(trimmed, {
          email: trimmed,
          waitlist_signed_up_at: nowIso,
          waitlist_source: "speedlearning.com",
        });
        window.cioanalytics.track("waitlist_signup", {
          source: "speedlearning.com",
          signed_up_at: nowIso,
        });
      } else if (process.env.NODE_ENV !== "production") {
        console.warn(
          "[waitlist] cioanalytics not loaded — snippet hasn't initialized yet."
        );
      }

      setStatus("success");
      setMessage("You're on the list. We'll email when it's ready.");
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

  return (
    <div>
      <form className="form" onSubmit={submit} noValidate>
        <input
          type="email"
          inputMode="email"
          autoComplete="email"
          placeholder="you@domain.com"
          value={email}
          onChange={(e) => {
            setEmail(e.target.value);
            if (status === "error") {
              setStatus("idle");
              setMessage("");
            }
          }}
          required
          aria-label="Email address"
          disabled={status === "submitting" || status === "success"}
        />
        <button
          type="submit"
          disabled={status === "submitting" || status === "success"}
        >
          {status === "submitting"
            ? "Joining…"
            : status === "success"
            ? "Joined"
            : "Join the waitlist"}
        </button>
      </form>
      <div className={metaClass} aria-live="polite">
        {message || "Early access, updates, and the occasional offer. Unsubscribe anytime."}
      </div>
    </div>
  );
}
