"use client";

import { useEffect, useState } from "react";
import { ShieldCheck, ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type Stage = "loading" | "off" | "enrolling" | "on";

export default function SecuritySettingsPage() {
	const [stage, setStage] = useState<Stage>("loading");
	const [required, setRequired] = useState(false);
	const [secret, setSecret] = useState("");
	const [otpauth, setOtpauth] = useState("");
	const [code, setCode] = useState("");
	const [backupCodes, setBackupCodes] = useState<string[] | null>(null);
	const [error, setError] = useState<string | null>(null);
	const [busy, setBusy] = useState(false);

	useEffect(() => {
		fetch("/api/auth/me")
			.then((r) => r.json() as Promise<{ user?: { twoFactorEnabled?: boolean; twoFactorRequired?: boolean } }>)
			.then((d) => {
				setRequired(Boolean(d?.user?.twoFactorRequired));
				setStage(d?.user?.twoFactorEnabled ? "on" : "off");
			})
			.catch(() => setStage("off"));
	}, []);

	async function beginSetup() {
		setError(null);
		setBusy(true);
		try {
			const res = await fetch("/api/auth/2fa/setup", { method: "POST" });
			const data = (await res.json()) as { secret?: string; otpauthUrl?: string; error?: string };
			if (!res.ok) throw new Error(data.error ?? "Could not start setup");
			setSecret(data.secret ?? "");
			setOtpauth(data.otpauthUrl ?? "");
			setStage("enrolling");
		} catch (e) {
			setError(e instanceof Error ? e.message : "Could not start setup");
		} finally {
			setBusy(false);
		}
	}

	async function confirmEnable() {
		setError(null);
		setBusy(true);
		try {
			const res = await fetch("/api/auth/2fa/verify", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ code: code.trim() }),
			});
			const data = (await res.json()) as { backupCodes?: string[]; error?: string };
			if (!res.ok) throw new Error(data.error ?? "Invalid code");
			setBackupCodes(data.backupCodes ?? []);
			setCode("");
			setStage("on");
		} catch (e) {
			setError(e instanceof Error ? e.message : "Invalid code");
		} finally {
			setBusy(false);
		}
	}

	async function disable() {
		setError(null);
		setBusy(true);
		try {
			const res = await fetch("/api/auth/2fa/disable", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ code: code.trim() }),
			});
			const data = (await res.json()) as { error?: string };
			if (!res.ok) throw new Error(data.error ?? "Invalid code");
			setCode("");
			setBackupCodes(null);
			setStage("off");
		} catch (e) {
			setError(e instanceof Error ? e.message : "Invalid code");
		} finally {
			setBusy(false);
		}
	}

	return (
		<div className="space-y-6 py-4">
			<div>
				<h1 className="text-2xl font-semibold text-neutral-900">Security</h1>
				<p className="mt-1 text-sm text-neutral-500">Protect your account with two-factor authentication (2FA).</p>
			</div>

			<div className="rounded-2xl border border-blue-100 bg-white p-6">
				<div className="flex items-start gap-3">
					{stage === "on" ? (
						<ShieldCheck className="mt-0.5 h-6 w-6 text-emerald-500" />
					) : (
						<ShieldAlert className="mt-0.5 h-6 w-6 text-amber-500" />
					)}
					<div className="flex-1">
						<h2 className="text-base font-semibold text-neutral-900">Authenticator app (TOTP)</h2>
						<p className="text-sm text-neutral-500">
							{stage === "on"
								? "Two-factor authentication is enabled on your account."
								: "Add a second step at sign-in using Google Authenticator, Authy, or 1Password."}
						</p>
					</div>
				</div>

				{error && (
					<p className="mt-4 rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">{error}</p>
				)}

				{stage === "off" && (
					<div className="mt-5">
						<Button onClick={beginSetup} disabled={busy} className="rounded-full">
							{busy ? "Starting…" : "Enable two-factor authentication"}
						</Button>
					</div>
				)}

				{stage === "enrolling" && (
					<div className="mt-5 space-y-4">
						<div className="space-y-2">
							<Label>1. Add this key to your authenticator app</Label>
							<div className="rounded-xl bg-neutral-50 px-4 py-3 font-mono text-sm tracking-wider text-neutral-800 break-all">
								{secret}
							</div>
							<a href={otpauth} className="text-xs text-blue-600 hover:underline break-all">
								Open in authenticator app
							</a>
						</div>
						<div className="space-y-2">
							<Label htmlFor="code">2. Enter the 6-digit code it shows</Label>
							<Input
								id="code"
								inputMode="numeric"
								placeholder="123456"
								value={code}
								onChange={(e) => setCode(e.target.value)}
								className="max-w-xs"
							/>
						</div>
						<div className="flex gap-3">
							<Button onClick={confirmEnable} disabled={busy} className="rounded-full">
								{busy ? "Verifying…" : "Verify & enable"}
							</Button>
							<Button variant="ghost" onClick={() => setStage("off")} className="rounded-full">
								Cancel
							</Button>
						</div>
					</div>
				)}

				{stage === "on" && (
					<div className="mt-5 space-y-4">
						{backupCodes && (
							<div className="rounded-xl border border-emerald-100 bg-emerald-50 p-4">
								<p className="text-sm font-medium text-emerald-800">
									Save these backup codes now — each can be used once if you lose your device.
								</p>
								<div className="mt-3 grid grid-cols-2 gap-2 font-mono text-sm text-emerald-900">
									{backupCodes.map((c) => (
										<span key={c}>{c}</span>
									))}
								</div>
							</div>
						)}
						{required ? (
							<p className="text-sm text-neutral-500">
								Two-factor authentication is required for your account by an administrator and cannot be turned off.
							</p>
						) : (
							<div className="space-y-2">
								<Label htmlFor="disable-code">Enter a current code to turn off 2FA</Label>
								<div className="flex gap-3">
									<Input
										id="disable-code"
										inputMode="numeric"
										placeholder="123456"
										value={code}
										onChange={(e) => setCode(e.target.value)}
										className="max-w-xs"
									/>
									<Button variant="destructive" onClick={disable} disabled={busy} className="rounded-full">
										{busy ? "Disabling…" : "Disable"}
									</Button>
								</div>
							</div>
						)}
					</div>
				)}
			</div>
		</div>
	);
}
