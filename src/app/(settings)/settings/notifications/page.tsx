import { NotificationSettingsForm } from "@/components/settings/notification-settings-form";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function SettingsNotificationsPage() {
	return (
		<div className="space-y-8 py-4">
			<div>
				<h1 className="text-3xl font-medium text-neutral-900">Notifications</h1>
				<p className="mt-1 text-sm text-neutral-500">
					Choose how trtMail alerts you when new mail arrives. These preferences are saved on this device.
				</p>
			</div>

			<Card className="rounded-3xl border-0 bg-white px-6">
				<CardHeader>
					<CardTitle>New-mail alerts</CardTitle>
					<CardDescription>Sound and desktop notifications for incoming messages.</CardDescription>
				</CardHeader>
				<CardContent className="pb-6">
					<NotificationSettingsForm />
				</CardContent>
			</Card>
		</div>
	);
}
