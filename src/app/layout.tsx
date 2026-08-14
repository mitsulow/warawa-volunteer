import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "わらわ〜ボランティア 熊本",
  description:
    "熊本地震の被災地支援。お金・体・物資 — 出せるものを持ち寄って、西福寺（熊本県八代郡氷川町）を拠点に支え合う。",
  metadataBase: new URL("https://warawa-volunteer.vercel.app"),
  openGraph: {
    title: "わらわ〜ボランティア 熊本",
    description:
      "熊本地震の被災地支援。お金・体・物資 — 出せるものを持ち寄って支え合う。",
    url: "https://warawa-volunteer.vercel.app",
    siteName: "わらわ〜ボランティア",
    images: ["/icon-512.png"],
    type: "website",
  },
  icons: {
    icon: "/icon-192.png",
    apple: "/icon-192.png",
  },
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "わらわ〜ボランティア",
  },
};

export const viewport: Viewport = {
  themeColor: "#d96c2c",
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
        <div className="mx-auto min-h-screen max-w-[520px] bg-washi shadow-xl">
          {children}
        </div>
      </body>
    </html>
  );
}
