import type { Metadata } from "next";
import "./globals.css";
import { AppShell } from "@/components/ui/app-shell";

export const metadata: Metadata = {
  title: "TFT ATLAS - Tra cứu tướng, đội hình & so sánh bản cập nhật ĐTCL Mùa 18",
  description: "Bản đồ tra cứu Đấu Trường Chân Lý Mùa 18: Danh mục tướng, bảng xếp hạng đội hình top meta và so sánh chi tiết bản cập nhật.",
  icons: {
    icon: "/favicon.ico",
  }
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="vi" className="dark">
      <body>
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}
