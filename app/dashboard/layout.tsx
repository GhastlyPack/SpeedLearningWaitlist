import type { Metadata } from "next";
import "../globals.css";
import "./dashboard.css";

export const metadata: Metadata = {
  title: "SpeedLearning · Dashboard",
  description: "Internal team metrics.",
  robots: { index: false, follow: false, nocache: true },
};

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
