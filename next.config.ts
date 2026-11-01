import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  outputFileTracingIncludes: {
    "/api/export/forms": ["./resources/export-templates/**/*","./resources/workbook-templates/**/*","./scripts/office-print-preview.ps1","./scripts/word-print-preview.vbs"],
    "/api/export/category-history": ["./resources/export-templates/**/*","./resources/workbook-templates/**/*"],
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          {
            key: "X-Frame-Options",
            value: "DENY",
          },
          {
            key: "X-Content-Type-Options",
            value: "nosniff",
          },
          {
            key: "Referrer-Policy",
            value: "strict-origin-when-cross-origin",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
