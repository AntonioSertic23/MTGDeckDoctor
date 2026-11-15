import type { Metadata, Viewport } from "next";
import { Fraunces, Source_Sans_3 } from "next/font/google";
import { AppShell } from "@/components/app-shell";
import { DialogProvider } from "@/components/dialog";
import { RegisterServiceWorker } from "@/components/register-sw";
import { ToastProvider } from "@/components/toast";
import { THEME_INIT_SCRIPT } from "@/lib/theme";
import { AuthProvider } from "@/lib/auth/auth-provider";
import "./globals.css";

const display = Fraunces({
  variable: "--font-display",
  subsets: ["latin"],
  axes: ["SOFT", "opsz"],
});

const sans = Source_Sans_3({
  variable: "--font-sans",
  subsets: ["latin"],
});

const APP_NAME = "MTG Deck Doctor";
const APP_DESCRIPTION =
  "Diagnose Commander decks, find problems, suggest cuts and additions, and track shared physical cards.";

export const metadata: Metadata = {
  title: {
    default: APP_NAME,
    template: `%s · ${APP_NAME}`,
  },
  description: APP_DESCRIPTION,
  applicationName: APP_NAME,
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: APP_NAME,
  },
  formatDetection: {
    telephone: false,
  },
  icons: {
    icon: [
      { url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [{ url: "/icons/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#0c7a66" },
    { media: "(prefers-color-scheme: dark)", color: "#0a0f14" },
  ],
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="en"
      className={`${display.variable} ${sans.variable} h-full antialiased`}
      // The inline theme script sets data-theme before React hydrates.
      suppressHydrationWarning
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
      </head>
      <body className="min-h-full flex flex-col font-sans">
        <AuthProvider>
          <ToastProvider>
            <DialogProvider>
              <AppShell>{children}</AppShell>
            </DialogProvider>
          </ToastProvider>
        </AuthProvider>
        <RegisterServiceWorker />
      </body>
    </html>
  );
}
