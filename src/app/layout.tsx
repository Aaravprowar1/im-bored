import type { Metadata, Viewport } from "next";
import { Inter, Instrument_Serif } from "next/font/google";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { ToastProvider } from "@/components/toast";
import { ViewerProvider } from "@/components/viewer-context";
import { publicConfig } from "@/lib/config";
import { getViewer } from "@/lib/viewer";
import "./globals.css";

const serif = Instrument_Serif({ subsets: ["latin"], weight: "400", style: ["normal", "italic"], variable: "--font-instrument-serif" });
const sans = Inter({ subsets: ["latin"], variable: "--font-inter" });

export const metadata: Metadata = {
  metadataBase: new URL(publicConfig.siteUrl),
  title: { default: "im bored. — Find something to do", template: "%s — im bored." },
  description: "Get a random activity that fits your time, place, energy and mood. Explore. Be creative. Do something different.",
  openGraph: {
    type: "website",
    siteName: "im bored.",
    title: "im bored. — Find something to do",
    description: "Get a random activity to do. Explore. Be creative. Do something different.",
  },
  twitter: { card: "summary", title: "im bored.", description: "Get a random activity to do." },
};

export const viewport: Viewport = { themeColor: "#f7f5f0", width: "device-width", initialScale: 1 };

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const fullViewer = await getViewer();
  // The email address is not needed by client components, so it is not sent to the browser here.
  const viewer = { ...fullViewer, user: fullViewer.user ? { ...fullViewer.user, email: null } : null };
  return (
    <html lang="en" className={`${serif.variable} ${sans.variable}`}>
      <body className="min-h-dvh antialiased">
        <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-full focus:bg-ink focus:px-4 focus:py-2 focus:text-bg">
          Skip to content
        </a>
        <ViewerProvider viewer={viewer}>
          <ToastProvider>
            <SiteHeader />
            <main id="main">{children}</main>
            <SiteFooter />
          </ToastProvider>
        </ViewerProvider>
      </body>
    </html>
  );
}
