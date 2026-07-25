import type { Metadata } from "next";
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
  title: "TraceForge AI — DFIR Investigation Platform",
  description:
    "Learn Digital Forensics by reconstructing real cyber attacks. Interactive Incident Timeline Reconstruction Platform for PWNDORA CyberDev Summit.",
  keywords: ["DFIR", "cybersecurity", "forensics", "incident response", "MITRE ATT&CK"],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-[#050507] text-white`}
      >
        {children}
      </body>
    </html>
  );
}
