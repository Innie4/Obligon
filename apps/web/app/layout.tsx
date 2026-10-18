import type { Metadata } from "next";
import localFont from "next/font/local";
import "./globals.css";
import { Providers } from "@/components/shared/Providers";
import { CookieConsentBanner } from "@/components/site/CookieConsentBanner";

const inter = localFont({
  src: "./fonts/Inter-variable.woff2",
  weight: "400 800",
  style: "normal",
  variable: "--font-inter",
  display: "swap"
});

const plusJakarta = localFont({
  src: "./fonts/PlusJakartaSans-variable.woff2",
  weight: "400 800",
  style: "normal",
  variable: "--font-plus-jakarta",
  display: "swap"
});

export const metadata: Metadata = {
  title: "Obligon LTD | Fuel Cards and Spending Controls",
  description: "Fuel cards, spending controls, recorded transactions, and approved station access for individuals and businesses in Nigeria.",
  // app/icon.svg is picked up automatically and emitted as the favicon link, but
  // naming it here as well is what puts the brand in the tab for browsers and
  // hostings that read metadata rather than the file convention. There was no
  // icon at all before, so every tab showed whatever the browser guessed.
  icons: {
    icon: [{ url: "/icon.svg", type: "image/svg+xml" }],
    shortcut: ["/icon.svg"],
    apple: [{ url: "/icon.svg" }]
  }
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" data-scroll-behavior="smooth">
      <body className={`${inter.variable} ${plusJakarta.variable} font-sans antialiased`}>
        <Providers>
          {children}
          <CookieConsentBanner />
        </Providers>
      </body>
    </html>
  );
}
