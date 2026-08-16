import type { Metadata, Viewport } from "next";
import { BadgeSync } from "@/components/BadgeSync";
import { InAppBrowserGuard } from "@/components/InAppBrowserGuard";
import { InstallPrompt } from "@/components/InstallPrompt";
import { PopupAnnouncement } from "@/components/PopupAnnouncement";
import { PushSetup } from "@/components/PushSetup";
import "./globals.css";

export const metadata: Metadata = {
  title: "わらわ〜ボランティア",
  description: "届けたいのは「大丈夫」、配りたいのは「笑顔」。",
  metadataBase: new URL("https://warawa-volunteer.vercel.app"),
  openGraph: {
    title: "わらわ〜ボランティア",
    description: "届けたいのは「大丈夫」、配りたいのは「笑顔」。",
    url: "https://warawa-volunteer.vercel.app",
    siteName: "わらわ〜ボランティア",
    images: [{ url: "/ogp.png", width: 1200, height: 630 }],
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "わらわ〜ボランティア",
    description: "届けたいのは「大丈夫」、配りたいのは「笑顔」。",
    images: ["/ogp.png"],
  },
  icons: {
    icon: "/icon-192.png",
    apple: "/icon-192.png",
  },
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "ボランティア",
  },
};

export const viewport: Viewport = {
  themeColor: "#d96a1a",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ja">
      <body>
        <InAppBrowserGuard />
        <InstallPrompt />
        <PushSetup />
        <PopupAnnouncement />
        <BadgeSync />
        <div className="mx-auto min-h-screen max-w-[520px] bg-washi shadow-xl">
          {children}
        </div>
      </body>
    </html>
  );
}
