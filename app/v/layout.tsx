/**
 * Variant route wrapper. Deliberately minimal — each variant under
 * /v/<slug>/page.tsx owns its own visual identity (background, fonts,
 * layout, copy), so a shared header/footer would defeat the test.
 *
 * The root app/layout.tsx still applies above us — global fonts load,
 * GA + Meta Pixel + UtmCapture still mount — so variants automatically
 * get analytics and attribution without each having to wire it up.
 */
export default function VariantLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
