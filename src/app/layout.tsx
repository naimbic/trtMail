import type { Metadata } from "next";
import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";
import { Providers } from "@/components/providers";
import "./globals.css";

export const metadata: Metadata = {
	title: "trtDigital Mail",
	description: "Private email workspace",
	icons: { icon: "/api/branding/icon" },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
	return (
		<html lang="en">
			<head>
				<link rel="icon" href="/api/branding/icon"></link>
			</head>
			<body className={`${GeistSans.variable} ${GeistMono.variable} antialiased light`}>
				<Providers>{children}</Providers>
			</body>
		</html>
	);
}
