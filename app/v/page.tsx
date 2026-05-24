import type { Metadata } from "next";
import Link from "next/link";
import { VARIANTS } from "@/lib/variants";

/**
 * Internal index of every lander variant. Not linked from anywhere public —
 * lives here so the team has one URL (speedlearning.com/v) to browse all
 * the design variations during the conversion test.
 *
 * noindex so search engines don't surface it; conversion-test variants
 * shouldn't be indexed independently of the canonical lander anyway.
 */

export const metadata: Metadata = {
  title: "SpeedLearning — Lander Variants",
  robots: { index: false, follow: false },
};

export default function VariantsIndex() {
  return (
    <main
      style={{
        maxWidth: 720,
        margin: "0 auto",
        padding: "80px 32px",
        fontFamily: "var(--font-plex), system-ui, sans-serif",
        color: "var(--ink)",
      }}
    >
      <h1
        style={{
          fontSize: 28,
          fontWeight: 600,
          letterSpacing: "-0.4px",
          marginBottom: 8,
        }}
      >
        Lander variants
      </h1>
      <p style={{ color: "var(--ink-mute)", fontSize: 14, marginBottom: 40 }}>
        10 design alternatives to the control lander. Each runs the same
        waitlist offer and tracks signups under its own <code>variant</code>{" "}
        attribute. Compare conversion in the dashboard.
      </p>

      <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
        <VariantRow
          slug="(control)"
          name="Control"
          description="The current lander at speedlearning.com — editorial minimal."
          href="/"
        />
        {VARIANTS.map((v) => (
          <VariantRow
            key={v.slug}
            slug={v.slug}
            name={v.name}
            description={v.description}
            href={`/v/${v.slug}`}
          />
        ))}
      </div>
    </main>
  );
}

function VariantRow({
  slug,
  name,
  description,
  href,
}: {
  slug: string;
  name: string;
  description: string;
  href: string;
}) {
  return (
    <Link
      href={href}
      style={{
        display: "grid",
        gridTemplateColumns: "120px 1fr",
        gap: 24,
        padding: "16px 0",
        borderTop: "1px solid var(--rule)",
        color: "inherit",
        textDecoration: "none",
      }}
    >
      <code
        style={{
          fontFamily: "var(--font-mono), monospace",
          fontSize: 12,
          color: "var(--ink-mute)",
          letterSpacing: 0.5,
        }}
      >
        /v/{slug}
      </code>
      <div>
        <div style={{ fontWeight: 500, fontSize: 15 }}>{name}</div>
        <div
          style={{
            fontSize: 13,
            color: "var(--ink-mute)",
            marginTop: 2,
          }}
        >
          {description}
        </div>
      </div>
    </Link>
  );
}
