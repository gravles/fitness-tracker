import type { Metadata, Viewport } from "next";
import { Inter, Sora } from "next/font/google";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
});

const sora = Sora({
  variable: "--font-sora",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Life Logger",
  description: "Daily fitness and nutrition tracker",
  manifest: "/manifest.json",
  icons: {
    apple: "/icon-192.png",
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Life Logger",
  },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f7f8fa" },
    { media: "(prefers-color-scheme: dark)", color: "#060a13" },
  ],
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

import { SWRegister } from "@/components/SWRegister";
import { AuthWrapper } from "@/components/AuthWrapper";
import { SyncManager } from "@/components/SyncManager";
import { CapacitorProvider } from "@/components/CapacitorProvider";
import { ThemeProvider } from "@/components/ThemeProvider";
import { LanguageProvider } from "@/components/LanguageProvider";
import { ConfirmProvider } from "@/components/ConfirmDialog";
import { Toaster } from "sonner";

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    // suppressHydrationWarning: the theme class is stamped pre-paint by the
    // inline script below, so the server HTML never matches on purpose
    <html lang="en" suppressHydrationWarning>
      <head>
        {/* Prevent flash of wrong theme on load */}
        <script dangerouslySetInnerHTML={{ __html: `(function(){try{var t=localStorage.getItem('theme');var dark=t==='dark'||(t!=='light'&&window.matchMedia('(prefers-color-scheme: dark)').matches);document.documentElement.classList.add(dark?'dark':'light');}catch(e){}})();` }} />
      </head>
      <body className={`${inter.variable} ${sora.variable} antialiased`}>
        <SWRegister />
        <ThemeProvider>
        <LanguageProvider>
        <ConfirmProvider>
        <AuthWrapper>
          <CapacitorProvider>
          <SyncManager />
          <Toaster
            position="bottom-center"
            toastOptions={{
              style: {
                background: "var(--color-surface-elevated)",
                border: "1px solid var(--color-border)",
                color: "var(--color-text)",
                fontFamily: "var(--font-sans)",
                boxShadow: "var(--shadow-lg)",
              },
            }}
          />
          <div className="max-w-2xl mx-auto min-h-dvh pb-24 relative border-x border-[var(--color-border-light)] shadow-2xl bg-[var(--color-bg)]">
            {children}
          </div>
          </CapacitorProvider>
        </AuthWrapper>
        </ConfirmProvider>
        </LanguageProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
