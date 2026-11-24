import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "NICE TRY — a completely fair platformer",
  description:
    "Reach the door. The room will disagree. Ten short levels, instant respawns, and absolutely no unfair surprises whatsoever.",
  openGraph: {
    title: "NICE TRY",
    description: "A completely fair platformer. Reach the door.",
    type: "website",
  },
};

export const viewport: Viewport = {
  themeColor: "#f4efe6",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
