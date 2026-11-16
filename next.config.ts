import type { NextConfig } from "next";
import path from "node:path";

function getDistDir(): string | undefined {
  const custom = process.env.NEXT_DIST_DIR ? process.env.NEXT_DIST_DIR.trim() : undefined;
  if (!custom) return undefined;

  const normalized = custom.replace(/\\/g, "/");
  if (normalized.includes("..") || path.isAbsolute(custom) || /^[a-zA-Z]:/.test(custom)) {
    throw new Error(`[nextConfig] Invalid NEXT_DIST_DIR '${custom}'. Path traversal and absolute paths are prohibited.`);
  }

  // Restrict to dedicated safe build namespace: must start with .next or .cache-build
  const forbiddenRoots = [
    "src", "public", "storage", "docs", "tests", "scripts",
    "node_modules", ".git", "artifacts"
  ];
  const firstSegment = normalized.split("/")[0].toLowerCase();
  if (forbiddenRoots.includes(firstSegment)) {
    throw new Error(`[nextConfig] Invalid NEXT_DIST_DIR '${custom}'. Target cannot be a project source, data, or config directory.`);
  }

  if (!firstSegment.startsWith(".next") && !firstSegment.startsWith(".cache-build")) {
    throw new Error(`[nextConfig] Invalid NEXT_DIST_DIR '${custom}'. Must reside in dedicated build namespace starting with '.next'.`);
  }

  return custom;
}

const nextConfig: NextConfig = {
  distDir: getDistDir(),
  output: process.env.STANDALONE ? "standalone" : undefined,
  reactStrictMode: true,
  serverExternalPackages: ["@electric-sql/pglite", "pg"],
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "raw.communitydragon.org"
      },
      {
        protocol: "https",
        hostname: "ddragon.leagueoflegends.com"
      }
    ]
  }
};

export default nextConfig;
