import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@archmanga/shared"],
  webpack: (config) => {
    config.resolve.fallback = {
      ...config.resolve.fallback,
      canvas: false
    };
    return config;
  }
};

export default nextConfig;
