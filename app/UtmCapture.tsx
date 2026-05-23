"use client";

import { useEffect } from "react";
import { captureUtmsFromUrl } from "@/lib/utms";

/**
 * Mount once in the root layout. Runs on the client after hydration, captures
 * any utm_*, fbclid, gclid, ref, landing_page, external referrer into a
 * first-touch cookie. The cookie persists 30 days and is read on form submit
 * so the resulting CIO person record gets the acquisition attributes.
 */
export default function UtmCapture() {
  useEffect(() => {
    captureUtmsFromUrl();
  }, []);
  return null;
}
