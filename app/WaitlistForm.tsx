"use client";

import { useWaitlistForm } from "@/lib/useWaitlistForm";
import ShareButtons from "./ShareButtons";

/**
 * The CONTROL lander's form. Each /v/<slug> variant renders its own form
 * markup using the same useWaitlistForm hook directly — they don't import
 * this component. Keep this file scoped to the control's editorial look.
 */

interface WaitlistFormProps {
  /** Variant slug forwarded to /api/cio-track. Defaults to "control". */
  variant?: string;
}

export default function WaitlistForm({ variant = "control" }: WaitlistFormProps = {}) {
  const {
    firstName,
    setFirstName,
    lastName,
    setLastName,
    email,
    setEmail,
    status,
    message,
    referralCode,
    submittedFirstName,
    locked,
    submit,
    clearError,
  } = useWaitlistForm({ variant });

  const metaClass =
    status === "error"
      ? "form-meta error"
      : status === "success"
      ? "form-meta success"
      : "form-meta";

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
