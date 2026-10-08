import type { Metadata, Viewport } from "next";
import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";
import { Providers } from "@/components/providers";
import { ServiceWorkerRegister } from "@/components/service-worker-register";
import "./globals.css";

export const metadata: Metadata = {
	title: "trtDigital Mail",
	description: "Private email workspace",
	icons: { icon: "/api/branding/icon", apple: "/apple-touch-icon.png" },
	manifest: "/manifest.webmanifest",
	appleWebApp: { capable: true, title: "trtMail", statusBarStyle: "default" },
};

export const viewport: Viewport = { themeColor: "#2563eb" };

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
	return (
		<html lang="en">
			<head>
				<link rel="icon" href="/api/branding/icon"></link>
			</head>
			<body className={`${GeistSans.variable} ${GeistMono.variable} antialiased light`}>
				<Providers>{children}</Providers>
				<ServiceWorkerRegister />
			</body>
		</html>
	);
}
