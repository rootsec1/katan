import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "Rill — Gather around", template: "%s · Rill" },
  description: "A living tabletop strategy game for three or four friends.",
  applicationName: "Rill",
};

export const viewport: Viewport = { width: "device-width", initialScale: 1, themeColor: "#f4ead2" };

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
