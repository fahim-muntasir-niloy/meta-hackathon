import type { Metadata } from "next";
import { Hind_Siliguri, Inter } from "next/font/google";
import "@openuidev/react-ui/styles/index.css";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });
const bangla = Hind_Siliguri({ subsets: ["bengali", "latin"], weight: ["400", "500", "600"], variable: "--font-bangla" });

export const metadata: Metadata = {
  title: "KrishiBondhu.AI — কৃষকের ডিজিটাল বন্ধু",
  description: "ফসলের সমস্যার পরামর্শ, আবহাওয়া আর কৃষি অফিসারের সাক্ষাৎ — বাংলাদেশের কৃষকদের জন্য",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="bn" suppressHydrationWarning>
      <body className={`${inter.variable} ${bangla.variable}`}>{children}</body>
    </html>
  );
}
