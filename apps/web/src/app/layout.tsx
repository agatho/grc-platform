import type { Metadata } from "next";
import { Inter, Instrument_Sans } from "next/font/google";
import { SessionProvider } from "next-auth/react";
import { NextIntlClientProvider } from "next-intl";
import { getLocale, getMessages } from "next-intl/server";
import { ThemeProvider } from "@/components/theme-provider";
import { ReactQueryProvider } from "@/components/providers/query-provider";
import { LegalFooter } from "@/components/layout/legal-footer";
import { Toaster } from "@/components/ui/sonner";
import "@/styles/globals.css";

// All pages require authentication — skip static generation at build time
export const dynamic = "force-dynamic";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-geist-sans",
  display: "swap",
});

const instrumentSans = Instrument_Sans({
  subsets: ["latin"],
  variable: "--font-heading",
  weight: ["400", "500", "600", "700"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "ARCTOS — GRC Platform",
  description: "Audit, Risk, Compliance & Trust Operating System",
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const locale = await getLocale();
  const messages = await getMessages();

  return (
    <html
      lang={locale}
      suppressHydrationWarning
      className={`${inter.variable} ${instrumentSans.variable}`}
    >
      <body className="font-sans antialiased">
        {/*
          #NIGHT-042: SessionProvider gets refetchOnWindowFocus/refetchInterval
          turned off so every tab focus does not re-poll /api/auth/session,
          and the ReactQueryProvider lets layout fan-out (Bell, org switcher,
          user menu) share a single cache instead of each component firing
          its own fetch on mount.
        */}
        <SessionProvider refetchOnWindowFocus={false} refetchInterval={0}>
          <ReactQueryProvider>
            <ThemeProvider>
              <NextIntlClientProvider messages={messages}>
                <div className="flex min-h-screen flex-col">
                  <div className="flex-1">{children}</div>
                  <LegalFooter />
                </div>
                <Toaster
                  position="top-right"
                  richColors
                  closeButton
                  duration={6000}
                />
              </NextIntlClientProvider>
            </ThemeProvider>
          </ReactQueryProvider>
        </SessionProvider>
      </body>
    </html>
  );
}
