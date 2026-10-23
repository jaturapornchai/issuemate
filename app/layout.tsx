import type { Metadata, Viewport } from "next";
import { IBM_Plex_Mono, IBM_Plex_Sans_Thai } from "next/font/google";
import "./globals.css";

const plexSansThai = IBM_Plex_Sans_Thai({
  subsets: ["thai", "latin"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
  variable: "--font-plex-sans",
});

const plexMono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  display: "swap",
  variable: "--font-plex-mono",
});

export const metadata: Metadata = {
  title: "IssueMate — แจ้งปัญหา สอบถาม และติดตามงาน (AI/MCP Ready)",
  description:
    "ระบบติดตามปัญหา (Bug Tracker), รับความต้องการจากทีมงาน (Feature Request), แนบรูปภาพและเอกสารหลายไฟล์ผ่าน MinIO และเชื่อมต่อ AI ผ่าน MCP Server ครบวงจร",
  keywords: [
    "Issue Tracker",
    "GitHub Issues Thai",
    "Project Management",
    "MCP Server",
    "MongoDB",
    "MinIO",
    "AI Issue Resolution",
  ],
  openGraph: {
    title: "IssueMate — ระบบติดตามปัญหาและความต้องการของทีม พร้อม AI MCP",
    description:
      "แยกโปรเจกต์ แนบรูปภาพและเอกสารหลายไฟล์ มีหน้าจอ Monitor แบบเรียลไทม์ พร้อมเชื่อมต่อ AI",
    type: "website",
  },
};

export const viewport: Viewport = {
  themeColor: "#07090e",
  colorScheme: "dark",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    name: "IssueMate",
    applicationCategory: "BusinessApplication",
    operatingSystem: "Web",
    description:
      "ระบบจัดการ Issues และความต้องการจากทีมงาน รองรับหลายโปรเจกต์ แนบรูปภาพและเอกสารผ่าน MinIO พร้อม Live Monitor และ MCP Server สำหรับ AI",
  };

  return (
    <html lang="th" className={`dark ${plexSansThai.variable} ${plexMono.variable}`}>
      <head>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
      </head>
      <body className="bg-canvas font-sans text-fg antialiased">{children}</body>
    </html>
  );
}
