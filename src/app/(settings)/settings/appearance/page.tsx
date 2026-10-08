import { InstallAppCard } from "@/components/settings/install-app-card";
import { AppearanceSettingsForm } from "@/components/settings/appearance-settings-form";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function SettingsAppearancePage() {
	return (
		<div className="space-y-8 py-4">
			<div>
				<h1 className="text-3xl font-medium text-neutral-900">Appearance</h1>
				<p className="mt-1 text-sm text-neutral-500">
					Turn inbox features on or off. These preferences are saved on this device.
				</p>
			</div>

			<Card className="rounded-3xl border-0 bg-white px-6">
				<CardHeader>
					<CardTitle>Message list</CardTitle>
					<CardDescription>Control how emails are shown in your folders.</CardDescription>
				</CardHeader>
				<CardContent className="pb-6">
					<AppearanceSettingsForm />
				</CardContent>
			</Card>

			<Card className="rounded-3xl border-0 bg-white px-6">
				<CardHeader>
					<CardTitle>App</CardTitle>
					<CardDescription>Add trtMail to your desktop or phone.</CardDescription>
				</CardHeader>
				<CardContent className="pb-6">
					<InstallAppCard />
				</CardContent>
			</Card>
		</div>
	);
}
