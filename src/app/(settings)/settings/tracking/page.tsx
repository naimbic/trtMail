import { TrackingSettingsForm } from "@/components/settings/tracking-settings-form";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function SettingsTrackingPage() {
	return (
		<div className="space-y-8 py-4">
			<div>
				<h1 className="text-3xl font-medium text-neutral-900">Tracking</h1>
				<p className="mt-1 text-sm text-neutral-500">See whether the mails you send were received, opened and clicked.</p>
			</div>
			<Card className="rounded-3xl border-0 bg-white px-6">
				<CardHeader>
					<CardTitle>Mail tracking</CardTitle>
					<CardDescription>Applies to every HTML mail sent from this installation.</CardDescription>
				</CardHeader>
				<CardContent className="pb-6">
					<TrackingSettingsForm />
				</CardContent>
			</Card>
		</div>
	);
}
