/**
 * Internal-email detection.
 *
 * Used to exclude team members from analytics & ad reporting so test
 * signups don't inflate Meta lead counts, GA conversions, or the
 * dashboard's waitlist total. Internal signups still flow into Customer.io
 * (tagged with `internal: true`) so we can verify the confirmation email
 * end-to-end, but they're filtered out everywhere counts matter.
 *
 * Both the browser (WaitlistForm) and the server (cio-track route, cio
 * dashboard loader) consult this helper. Keep this list in sync with
 * whatever domains the team actually uses to sign up for testing.
 */

const INTERNAL_DOMAINS: ReadonlyArray<string> = ["bowskyventures.com"];

export function isInternalEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  const normalized = email.trim().toLowerCase();
  const at = normalized.lastIndexOf("@");
  if (at < 0) return false;
  const domain = normalized.slice(at + 1);
  return INTERNAL_DOMAINS.includes(domain);
}
