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
				source: "/(.*)",
				headers: getSecurityHeaders(),
			},
		];
	},
};

export default nextConfig;
