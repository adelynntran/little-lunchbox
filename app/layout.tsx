import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Little Lunchbox",
  description: "A cozy weekly menu and grocery list maker.",
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
