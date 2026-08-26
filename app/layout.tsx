import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Custom Prompt Library · Mission Control powered by NeenOS",
  description:
    "Neen's custom, searchable library of copy-ready prompts.",
  other: {
    "codex-preview": "development",
  },
  manifest: "/manifest.json",
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
    apple: "/favicon.svg",
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Prompt Library",
  },
};

export const viewport = {
  themeColor: "#111326",
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
