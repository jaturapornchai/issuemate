import type { NextConfig } from "next";

const buildDate = new Date();
const thaiFormatted = new Intl.DateTimeFormat("th-TH", {
  timeZone: "Asia/Bangkok",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
}).format(buildDate);

const nextConfig: NextConfig = {
  output: "standalone",
  reactStrictMode: true,
  images: {
    unoptimized: true,
  },
  env: {
    NEXT_PUBLIC_APP_VERSION: "v3.5.0",
    NEXT_PUBLIC_DEPLOYED_AT_TH: `${thaiFormatted} น.`,
    NEXT_PUBLIC_DEPLOYED_AT_ISO: buildDate.toISOString(),
  },
};

export default nextConfig;
