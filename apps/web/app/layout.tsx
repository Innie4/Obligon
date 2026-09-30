import type { Metadata } from "next";
import { Inter, Plus_Jakarta_Sans } from "next/font/google";
import "./globals.css";
import { Providers } from "@/components/shared/Providers";
import { CookieConsentBanner } from "@/components/site/CookieConsentBanner";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap"
});

const plusJakarta = Plus_Jakarta_Sans({
  subsets: ["latin"],
  variable: "--font-plus-jakarta",
  display: "swap"
});

export const metadata: Metadata = {
  title: "Obligon LTD | Powering Nigeria's Energy Infrastructure",
  description: "Enterprise-grade fuel card management, POS authorizations, generator IoT telemetry, and logistics solutions for Nigerian fleets.",
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
    <html lang="en">
      <body className={`${inter.variable} ${plusJakarta.variable} font-sans antialiased`}>
        <Providers>
          {children}
          <CookieConsentBanner />
        </Providers>
      </body>
    </html>
  );
}
