"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";

/**
 * Polls /api/latest-signup every POLL_MS and triggers a server-component
 * refresh when the CIO waitlist count goes up. Mounted invisibly in the
 * dashboard page; renders nothing.
 *
 * Behavior:
 *   - First tick establishes a baseline count (no refresh fired)
 *   - Subsequent ticks compare to baseline; if count increased, calls
 *     router.refresh() and bumps the baseline
 *   - Pauses while the tab is hidden (visibilitychange) and immediately
 *     re-checks when the tab regains focus — covers the "user comes back
 *     after lunch" case without polling against CIO for hours
 *   - Network errors are silently swallowed; next tick retries
 */
const POLL_MS = 30_000;

export default function SignupPoller() {
  const router = useRouter();
  const baselineRef = useRef<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    let intervalId: ReturnType<typeof setInterval> | null = null;

    async function check() {
      if (cancelled) return;
      if (typeof document !== "undefined" && document.visibilityState !== "visible") {
        return;
      }
      try {
        const res = await fetch("/api/latest-signup", { cache: "no-store" });
        if (!res.ok || cancelled) return;
        const data = (await res.json()) as { count?: number | null };
        if (cancelled) return;
        const count = typeof data.count === "number" ? data.count : null;
        if (count == null) return;

        if (baselineRef.current == null) {
          // First reading — establish baseline without refreshing.
          baselineRef.current = count;
        } else if (count > baselineRef.current) {
          // New signup landed — pull fresh data through the server component.
          baselineRef.current = count;
          router.refresh();
        }
      } catch {
        // Network blip — let the next interval retry.
      }
    }

    function onVisibilityChange() {
      if (document.visibilityState === "visible") {
        // Catch up immediately when the tab regains focus.
        check();
      }
    }

    // Fire one check right away to establish baseline within the first tick
    // rather than waiting the full POLL_MS.
    check();
    intervalId = setInterval(check, POLL_MS);
    document.addEventListener("visibilitychange", onVisibilityChange);

    return () => {
      cancelled = true;
      if (intervalId) clearInterval(intervalId);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, [router]);

  return null;
}
