import type { NextConfig } from "next";
const config: NextConfig = {
  output: "standalone",
  serverExternalPackages: ["pg", "pg-boss", "openid-client"],
  trailingSlash: true,
  images: { unoptimized: true },
  poweredByHeader: false,
};
export default config;
