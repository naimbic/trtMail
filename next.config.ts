import type { NextConfig } from "next";
import { getSecurityHeaders } from "./src/lib/security/headers";

const nextConfig: NextConfig = {
 output: "standalone",
 outputFileTracingExcludes: {"*": ["./.data/**/*", "./.env*", "./.dev.vars*", "./.wrangler/**/*", "./backups/**/*"]},
 serverExternalPackages: ["nodemailer", "imapflow"],
	turbopack: {
		root: import.meta.dirname,
	},
  allowedDevOrigins: ['mail.dev'],
	async headers() {
		return [
			{
				source: "/sw.js",
				headers: [
					{ key: "Cache-Control", value: "no-cache, no-store, must-revalidate" },
					{ key: "Service-Worker-Allowed", value: "/" },
				],
			},
			{
				source: "/(.*)",
				headers: getSecurityHeaders(),
			},
		];
	},
};

export default nextConfig;
