import type { Metadata, Viewport } from "next";
import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";
import { DotGrid } from "@/components/DotGrid";
import "./globals.css";

export const metadata: Metadata = {
  title: "hum",
  description: "Catch song ideas the moment they show up: hums, lyrics and moodboards.",
};

export const viewport: Viewport = {
  themeColor: "#131209",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${GeistSans.variable} ${GeistMono.variable} h-full`}>
      <body className="min-h-full">
        <DotGrid />
        {children}
      </body>
    </html>
  );
}
