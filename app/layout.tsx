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
    title: "Raya Serahill - Profile",
    description: "Heya! My name is Raya. I do a lot of things, but mostly I just like to learn new things and share them with others. I'm a software developer, a designer, and an aspiring artist!",

    openGraph: {
        title: "Raya Serahill - Profile",
        description:
            "Heya! My name is Raya. I do a lot of things, but mostly I just like to learn new things and share them with others. I'm a software developer, a designer, and an aspiring artist!",
        url: "https://serahill.net/",
        siteName: "Raya Serahill",
        images: [
            {
                url: "https://serahill.net/img/lizzer.png",
                width: 400,
                height: 400,
                alt: "Raya Serahill profile",
            },
        ],
        locale: "en_US",
        type: "website",
    },

    twitter: {
        card: "summary_large_image",
        title: "Raya Serahill - Profile",
        description:
            "Heya! My name is Raya. I do a lot of things, but mostly I just like to learn new things and share them with others. I'm a software developer, a designer, and an aspiring artist!",
        images: ["https://serahill.net/img/lizzer.png"],
    },

    robots: {
        index: true,
        follow: true,
    },

    keywords: [
        "Raya Serahill",
        "software developer",
        "designer",
        "artist",
        "portfolio",
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
        <Script src="/js/cute.js" strategy="afterInteractive" />
        </body>
        </html>
    );
}
