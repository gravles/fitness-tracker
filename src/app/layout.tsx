import type { Metadata, Viewport } from "next";
import { Inter, Playfair_Display } from "next/font/google";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
});

const playfair = Playfair_Display({
  variable: "--font-playfair",
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
    { media: "(prefers-color-scheme: light)", color: "#fafaf8" },
    { media: "(prefers-color-scheme: dark)", color: "#0d1b2a" },
  ],
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
};

import { SWRegister } from "@/components/SWRegister";
import { AuthWrapper } from "@/components/AuthWrapper";
import { SyncManager } from "@/components/SyncManager";
import { CapacitorProvider } from "@/components/CapacitorProvider";
import { ThemeProvider } from "@/components/ThemeProvider";
import { ConfirmProvider } from "@/components/ConfirmDialog";
import { Toaster } from "sonner";

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        {/* Prevent flash of wrong theme on load */}
        <script dangerouslySetInnerHTML={{ __html: `(function(){try{var t=localStorage.getItem('theme');if(t==='dark')document.documentElement.classList.add('dark');else if(t==='light')document.documentElement.classList.add('light');}catch(e){}})();` }} />
      </head>
      <body className={`${inter.variable} ${playfair.variable} antialiased`}>
        <SWRegister />
        <ThemeProvider>
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
        </ThemeProvider>
      </body>
    </html>
  );
}
