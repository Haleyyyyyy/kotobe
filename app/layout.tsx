import type { Metadata, Viewport } from "next";
import "./globals.css";
import { Provider } from "@/components/provider";
export const metadata: Metadata = {
  title: "Kotoba — 每天学点日语",
  description: "个人日语词汇学习与间隔复习。",
  manifest: "/manifest.webmanifest",
  icons: { icon: "/icon-192.png", apple: "/icon-192.png" },
  appleWebApp: { capable: true, statusBarStyle: "default", title: "Kotoba" },
};
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#5352bb",
};
export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN" suppressHydrationWarning>
      <body>
        <Provider>{children}</Provider>
      </body>
    </html>
  );
}
