import { type Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";
import { AuthProvider } from "@/lib/auth-context";
import { I18nProvider } from "@/lib/i18n-context";
import { LanguageStateProvider } from "@/components/language-state-provider";
import { PWAProvider } from "@/components/pwa-provider";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Emperor Coffee POS - Multi-Branch Point of Sale",
  description: "Professional multi-branch coffee shop franchise management system with centralized control and offline support",
  keywords: ["POS", "Coffee", "Franchise", "Multi-branch", "Emperor Coffee", "Offline", "PWA"],
  authors: [{ name: "Emperor Coffee" }],
  manifest: "/manifest.json",
  themeColor: "#059669",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Emperor POS",
  },
  icons: {
    icon: ["/icon-192.svg", "/icon-512.svg"],
    apple: "/icon-192.svg",
  },
  openGraph: {
    title: "Emperor Coffee POS",
    description: "Multi-branch coffee shop management system with offline support",
    type: "website",
  },
  viewport: {
    width: "device-width",
    initialScale: 1,
    maximumScale: 5,
    userScalable: true,
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" dir="ltr" suppressHydrationWarning>
      <head>
        <script
          src="/sw-loader.js"
          async
        />
      </head>
      <LanguageStateProvider>
        <body
          className={`${geistSans.variable} ${geistMono.variable} antialiased bg-background text-foreground`}
        >
          <PWAProvider>
            <I18nProvider>
              <AuthProvider>
                {children}
              </AuthProvider>
              <Toaster />
            </I18nProvider>
          </PWAProvider>
        </body>
      </LanguageStateProvider>
    </html>
  );
}
