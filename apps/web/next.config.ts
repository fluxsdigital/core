import path from "node:path";
import type { NextConfig } from "next";

const sitesExport = process.env.FLUX_SITES_EXPORT === "1";

const config: NextConfig = {
  transpilePackages: ["@flux/ui"],
  poweredByHeader: false,
  ...(sitesExport && { output: "export", trailingSlash: true }),
  ...(!sitesExport &&
    process.env.FLUX_STANDALONE === "1" && {
      output: "standalone",
      outputFileTracingRoot: path.resolve(process.cwd(), "../.."),
    }),
  ...(!sitesExport && {
    async rewrites() {
      if (process.env.FLUX_EXTERNAL_PROXY === "1" || process.env.NEXT_PUBLIC_FLUX_DEMO === "1") {
        return [];
      }
      const apiUrl = process.env.FLUX_API_URL ?? "http://127.0.0.1:3333";
      return ["/api/v1/:path*", "/docs/:path*", "/docs-json"].map((source) => ({
        source,
        destination: new URL(source, apiUrl).href,
      }));
    },
  }),
};

export default config;
