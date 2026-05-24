import { Newsreader } from "next/font/google";

/**
 * Cinematic Dark variant layout. Loads Newsreader at display weights for
 * the big serif headline. Scoped via CSS variable so we don't pay the
 * font weight on every page.
 */
const cinemaSerif = Newsreader({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600"],
  style: ["normal", "italic"],
  variable: "--font-cinema",
  display: "swap",
});

export default function CinemaLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <div className={cinemaSerif.variable}>{children}</div>;
}
