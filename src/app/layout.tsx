import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Life Logger",
  description: "Daily fitness and nutrition tracker",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Life Logger",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

import { AuthWrapper } from "@/components/AuthWrapper";

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-gray-50 text-gray-900`}
      >
        <div className="max-w-2xl mx-auto min-h-screen bg-white/50 backdrop-blur-sm pb-24 relative shadow-2xl shadow-gray-200 border-x border-white/50">
          <AuthWrapper>
            {children}
          </AuthWrapper>
          {/* Navigation injected here in page wrappers or globally? 
               Globally is better, but we need to ensure Auth checks. 
               The MainLayout handled auth. We might need a global Auth wrapper.
           */}
        </div>
      </body>
    </html>
  );
}
