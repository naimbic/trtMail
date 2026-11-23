ALTER TABLE `messages` ADD `tracking_token` text;
--> statement-breakpoint
ALTER TABLE `messages` ADD `sent_at` integer;
--> statement-breakpoint
ALTER TABLE `messages` ADD `delivery_status` text;
--> statement-breakpoint
ALTER TABLE `messages` ADD `delivery_detail` text;
--> statement-breakpoint
ALTER TABLE `messages` ADD `delivered_at` integer;
--> statement-breakpoint
ALTER TABLE `messages` ADD `bounced_at` integer;
--> statement-breakpoint
ALTER TABLE `messages` ADD `open_count` integer DEFAULT 0 NOT NULL;
--> statement-breakpoint
ALTER TABLE `messages` ADD `first_opened_at` integer;
--> statement-breakpoint
ALTER TABLE `messages` ADD `last_opened_at` integer;
--> statement-breakpoint
ALTER TABLE `messages` ADD `click_count` integer DEFAULT 0 NOT NULL;
--> statement-breakpoint
ALTER TABLE `messages` ADD `first_clicked_at` integer;
--> statement-breakpoint
ALTER TABLE `messages` ADD `last_clicked_at` integer;
--> statement-breakpoint
CREATE UNIQUE INDEX `messages_tracking_token_idx` ON `messages` (`tracking_token`);
--> statement-breakpoint
CREATE TABLE `message_tracking_links` (
	`id` text PRIMARY KEY NOT NULL,
	`message_id` text NOT NULL,
	`link_key` text NOT NULL,
	`url` text NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`message_id`) REFERENCES `messages`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `message_tracking_links_key_idx` ON `message_tracking_links` (`message_id`, `link_key`);
--> statement-breakpoint
CREATE TABLE `message_tracking_events` (
	`id` text PRIMARY KEY NOT NULL,
	`message_id` text NOT NULL,
	`type` text NOT NULL,
	`link_id` text,
	`url` text,
	`at` integer NOT NULL,
	`ignored` text,
	`is_first` integer DEFAULT false NOT NULL,
	`user_agent` text,
	`ip_hash` text,
	`detail` text,
	FOREIGN KEY (`message_id`) REFERENCES `messages`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `message_tracking_events_message_idx` ON `message_tracking_events` (`message_id`, `at`);
--> statement-breakpoint
CREATE INDEX `message_tracking_events_first_idx` ON `message_tracking_events` (`is_first`, `at`);
--> statement-breakpoint
ALTER TABLE `app_settings` ADD `mail_tracking_enabled` integer DEFAULT true NOT NULL;
