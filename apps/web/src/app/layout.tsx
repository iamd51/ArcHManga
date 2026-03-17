import type { Metadata } from "next";
import type { ReactNode } from "react";
import { QueryProvider } from "@/components/providers/query-provider";
import "./globals.css";

export const metadata: Metadata = {
  title: "ArcHManga",
  description: "Comic editor for ComfyUI-powered manga workflows"
};

export default function RootLayout({
  children
}: Readonly<{
  children: ReactNode;
}>) {
  return (
    <html lang="zh-Hant">
      <body>
        <QueryProvider>{children}</QueryProvider>
      </body>
    </html>
  );
}
