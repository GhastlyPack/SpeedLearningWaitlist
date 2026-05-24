"use client";

import { useState } from "react";
import { getStoredUtms } from "@/lib/utms";
import { isInternalEmail } from "@/lib/internal";

/**
 * Shared form behavior for every lander variant.
 *
 * Owns: form state (firstName / lastName / email / status / message /
 * referralCode), validation, internal-email detection, and the parallel
 * fan-out to GA gtag, Meta Pixel (PageView only — Lead is CAPI-only),
 * /api/meta-capi, and /api/cio-track on submit.
 *
 * Doesn't own markup. Each variant renders its own form JSX using the
 * returned state setters + submit handler, which keeps the wiring DRY
 * across 10+ variants without forcing them into a shared visual language.
 *
 * Returns:
 *   firstName / setFirstName, lastName / setLastName, email / setEmail
 *   status        — "idle" | "submitting" | "success" | "error"
 *   message       — user-visible status / error text
 *   referralCode  — set after a successful CIO write so ShareButtons can use it
 *   submittedFirstName — captured at submit time so success copy can address
 *                        the user even after we clear the input
 *   submit(e)     — the form's onSubmit handler
 *   clearError()  — resets status back to idle if user starts typing after an error
 *   locked        — true while submitting or after success (use to disable inputs/button)
 */

export type WaitlistFormStatus = "idle" | "submitting" | "success" | "error";

interface WindowWithTrackers extends Window {
  fbq?: (...args: unknown[]) => void;
  gtag?: (...args: unknown[]) => void;
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

export interface UseWaitlistFormOptions {
  /** Variant slug — sent to /api/cio-track. Defaults to "control". */
  variant?: string;
}

export interface UseWaitlistFormReturn {
  firstName: string;
  setFirstName: (v: string) => void;
  lastName: string;
  setLastName: (v: string) => void;
  email: string;
  setEmail: (v: string) => void;
  status: WaitlistFormStatus;
  message: string;
  referralCode: string | null;
  submittedFirstName: string;
  locked: boolean;
  submit: (e: React.FormEvent) => void;
  clearError: () => void;
}

export function useWaitlistForm(
  options: UseWaitlistFormOptions = {}
): UseWaitlistFormReturn {
  const { variant = "control" } = options;

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<WaitlistFormStatus>("idle");
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

    const win = typeof window !== "undefined"
      ? (window as WindowWithTrackers)
      : undefined;

    // -- GA4 "waitlist_signup" key event
    if (!internal) {
      try {
        if (win && typeof win.gtag === "function") {
          win.gtag("event", "waitlist_signup", {
            value: 0,
            currency: "USD",
            method: "email_form",
            variant,
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

    // Meta Lead is fired server-side ONLY (CAPI-only since 2026-05-22).
    // The browser Pixel still loads in layout.tsx and fires PageView
    // automatically for Custom Audiences / retargeting; we deliberately
    // do not fire fbq('track','Lead') from here.

    if (!internal && win) {
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

    if (win) {
      void fetch("/api/cio-track", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: cleanEmail,
          first_name: cleanFirst,
          last_name: cleanLast || undefined,
          source: "speedlearning.com",
          signed_up_at: nowIso,
          variant,
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
        .then((res) => (res.ok ? res.json() : null))
        .then((data) => {
          if (data && typeof data === "object" && "referral_code" in data) {
            setReferralCode(
              (data as { referral_code?: string }).referral_code ?? null
            );
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

  const locked = status === "submitting" || status === "success";

  return {
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
  };
}
