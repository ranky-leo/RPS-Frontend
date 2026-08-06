import "./globals.css";
import type { ReactNode } from "react";
import type { Viewport } from "next";

export const metadata = {
  title: "RPS Arena",
  description: "RPS Arena real-time match-based Rock Paper Scissors",

  openGraph: {
    title: "RPS Arena",
    description: "RPS Arena real-time match-based Rock Paper Scissors",
    url: "https://rps-arena.club",
    siteName: "RPS Arena",
    images: [
      {
        url: "https://zhfnufzsimulopgojpkb.supabase.co/storage/v1/object/public/Roshambo%20Videos/slogan_2.png",
        width: 1200,
        height: 630,
        alt: "RPS Arena",
      },
    ],
    type: "website",
  },

  twitter: {
    card: "summary_large_image",
    title: "RPS Arena",
    description: "RPS Arena real-time match-based Rock Paper Scissors",
    images: [
      "https://zhfnufzsimulopgojpkb.supabase.co/storage/v1/object/public/Roshambo%20Videos/slogan_2.png",
    ],
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" data-theme="arena-dark" className="perf-lite">
      <head>
        <link rel="icon" type="image/png" href="/logo.png" />
        <link rel="shortcut icon" type="image/png" href="/logo.png" />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link
          rel="preconnect"
          href="https://fonts.gstatic.com"
          crossOrigin="anonymous"
        />
        <link
          href="https://fonts.googleapis.com/css2?family=Cinzel:wght@700;800;900&family=Inter:wght@400;500;600;700;800;900&family=JetBrains+Mono:wght@400;700;800&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="themeArena">{children}</body>
    </html>
  );
}
