"use client";

import { useState } from "react";

type Status = "idle" | "submitting" | "success" | "error";

declare global {
  interface Window {
    _cio?: {
      identify: (attrs: Record<string, unknown>) => void;
      track: (name: string, attrs?: Record<string, unknown>) => void;
      page: (url?: string, attrs?: Record<string, unknown>) => void;
    };
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
      if (typeof window !== "undefined" && window._cio) {
        const now = Math.floor(Date.now() / 1000);
        window._cio.identify({
          id: trimmed,
          email: trimmed,
          created_at: now,
          waitlist_signed_up_at: now,
          waitlist_source: "speedlearning.com",
        });
        window._cio.track("waitlist_signup", {
          source: "speedlearning.com",
          signed_up_at: now,
        });
      } else if (process.env.NODE_ENV !== "production") {
        // Snippet not loaded (e.g. NEXT_PUBLIC_CIO_SITE_ID missing in dev).
        console.warn(
          "[waitlist] Customer.io snippet not loaded. Set NEXT_PUBLIC_CIO_SITE_ID."
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
        {message || "No spam. One email when it goes live."}
      </div>
    </div>
  );
}
