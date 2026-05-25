/**
 * Lander variant registry.
 *
 * Each entry corresponds to a page under app/v/<slug>/ that's an alternative
 * design / copy treatment of the same waitlist offer. The team drives equal
 * paid traffic to each, the dashboard breaks down CPL / conversion / Recent
 * Signups by `variant`, and we pick a winner (or three) to standardize on.
 *
 * The slug is part of the URL (speedlearning.com/v/<slug>) and is written
 * to CIO as the `variant` attribute on every signup that comes through the
 * variant page. The control lander at speedlearning.com/ writes
 * `variant: "control"` so we can compare every variant against it.
 */

export interface Variant {
  slug: string;
  name: string;
  /** One-line internal description for the dashboard / docs. */
  description: string;
  /** Style family from the UI/UX Pro Max catalog. Reference only — not used at runtime. */
  style: string;
  /**
   * True if this variant didn't make the cut for the active A/B test.
   * URL stays live (resolveVariantSlug still accepts it) so the
   * variant can be revived for retargeting campaigns later without a
   * code change beyond flipping this flag. The dashboard's Variant
   * filter hides archived variants UNLESS they have signups — so a
   * future retargeting campaign auto-surfaces in the dropdown.
   */
  archived?: boolean;
}

export const VARIANTS: ReadonlyArray<Variant> = [
  // Active variants — selected for the round-2 conversion test (May 2026).
  {
    slug: "brutalist",
    name: "Brutalist",
    description: "Thick black borders, hard shadows, raw mono type. No nonsense.",
    style: "Neubrutalism",
  },
  {
    slug: "editorial",
    name: "Editorial Magazine",
    description: "New York Times-y multi-column, drop caps, photojournalism.",
    style: "Editorial Grid / Magazine",
  },
  {
    slug: "y2k",
    name: "Y2K",
    description: "Chrome type over pink/cyan gradient. Very online.",
    style: "Y2K Aesthetic",
  },
  {
    slug: "blocks",
    name: "Vibrant Blocks",
    description: "Flat geometric blocks of saturated color. Stripe/Mailchimp era.",
    style: "Vibrant & Block-based",
  },
  {
    slug: "terminal",
    name: "Terminal",
    description: "Green-on-black, monospace everything, scanlines. Hacker vibes.",
    style: "Cyberpunk UI",
  },

  // Archived — didn't make the round-2 cut. URLs stay live for potential
  // retargeting use. Hidden from the dashboard variant dropdown until
  // they have signups, then auto-surfaced.
  {
    slug: "glass",
    name: "Glass",
    description: "Frosted cards over a soft gradient mesh. Modern SaaS polish.",
    style: "Glassmorphism",
    archived: true,
  },
  {
    slug: "cinema",
    name: "Cinematic Dark",
    description: "OLED black, big serif headline, restrained neon accent.",
    style: "Dark Mode (OLED)",
    archived: true,
  },
  {
    slug: "bento",
    name: "Bento Grid",
    description: "Apple-style modular tiles, each pitching one product benefit.",
    style: "Bento Box Grid",
    archived: true,
  },
  {
    slug: "clay",
    name: "Clay",
    description: "Soft 3D, pastel surfaces, rounded everything. Friendly + tactile.",
    style: "Claymorphism",
    archived: true,
  },
  {
    slug: "aurora",
    name: "Aurora",
    description: "Flowing gradient backdrop, modern minimal foreground.",
    style: "Aurora UI",
    archived: true,
  },
];

const VARIANT_SLUGS = new Set(VARIANTS.map((v) => v.slug));

/**
 * Validate a variant slug from a URL param. Returns the canonical slug if
 * valid, or null if not in the registry. Use to reject bogus /v/<garbage>
 * paths and to normalize "control" / undefined for the root lander.
 */
export function resolveVariantSlug(input: string | null | undefined): string | null {
  if (!input) return null;
  const normalized = input.trim().toLowerCase();
  if (!normalized) return null;
  return VARIANT_SLUGS.has(normalized) ? normalized : null;
}
