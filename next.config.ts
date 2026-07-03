import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Playwright is a heavy Node/native package driven only by the PDF route at
  // runtime (G9); keep it external so Next never tries to bundle it.
  serverExternalPackages: ["playwright"],
};

export default nextConfig;
