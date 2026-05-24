import { Newsreader } from "next/font/google";

/**
 * Editorial variant layout. Loads Newsreader at the weights this variant
 * actually uses (400 regular + italic for body, 600/700 for big serif
 * display headlines) and scopes the CSS variable to just /v/editorial/*
 * so we don't pay the font weight on every page.
 *
 * The global root layout already loads Newsreader 400, but display
 * headlines need 600/700 to read like a real magazine.
 */
const editorialSerif = Newsreader({
  subsets: ["latin"],
  weight: ["400", "600", "700"],
  style: ["normal", "italic"],
  variable: "--font-editorial",
  display: "swap",
});

export default function EditorialLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <div className={editorialSerif.variable}>{children}</div>;
}
