import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import Script from "next/script";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "sbjStats - Blackjack host platform",
  description: "sbjStats is a platform for ffxiv blackjack hosts. It allows hosts to upload their host data and produce publicly available statistics for their community.",

  openGraph: {
    title: "sbjStats - Blackjack host platform",
    description:
      "sbjStats is a platform for ffxiv blackjack hosts. It allows hosts to upload their host data and produce publicly available statistics for their community.",
    url: "https://stats.serahill.net/",
    siteName: "Raya Serahill",
    images: [
      {
        url: "https://stats.serahill.net/favicon.ico",
        width: 400,
        height: 400,
        alt: "sbjStats",
      },
    ],
    locale: "en_US",
    type: "website",
  },

  twitter: {
    card: "summary_large_image",
    title: "Raya Serahill - Profile",
    description:
      "sbjStats is a platform for ffxiv blackjack hosts. It allows hosts to upload their host data and produce publicly available statistics for their community.",
    images: ["https://stats.serahill.net/favicon.ico"],
  },

  robots: {
    index: true,
    follow: true,
  },

  keywords: [
    "sbj",
    "Simeple Blackjack",
    "stats",
    "sbjStats",
    "Raya Serahill",
  ],

  other: {
    "discord:creator": "@raya",
    "theme-color": "#ff69b4",
  },
};

export default function RootLayout({
                                     children,
                                   }: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={"scroll-smooth"}>
    <body
      className={`${geistSans.variable} ${geistMono.variable} antialiased`}
    >
    {children}
    </body>
    </html>
  );
}