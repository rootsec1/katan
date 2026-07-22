CREATE TABLE `room_events` (
	`sequence` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`room_id` text NOT NULL,
	`command_id` text NOT NULL,
	`revision` integer NOT NULL,
	`type` text NOT NULL,
	`payload` text NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`room_id`) REFERENCES `rooms`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `events_room_command_idx` ON `room_events` (`room_id`,`command_id`);--> statement-breakpoint
CREATE INDEX `events_room_sequence_idx` ON `room_events` (`room_id`,`sequence`);--> statement-breakpoint
CREATE TABLE `rooms` (
	`id` text PRIMARY KEY NOT NULL,
	`slug` text NOT NULL,
	`status` text NOT NULL,
	`host_player_id` text NOT NULL,
	`seat_count` integer NOT NULL,
	`state` text NOT NULL,
	`version` integer DEFAULT 0 NOT NULL,
	`automation_lock_until` integer,
	`last_activity_at` integer NOT NULL,
	`expires_at` integer NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `rooms_slug_unique` ON `rooms` (`slug`);--> statement-breakpoint
CREATE INDEX `rooms_expires_at_idx` ON `rooms` (`expires_at`);--> statement-breakpoint
CREATE TABLE `seats` (
	`id` text PRIMARY KEY NOT NULL,
	`room_id` text NOT NULL,
	`player_id` text NOT NULL,
	`position` integer NOT NULL,
	`resume_token_hash` text NOT NULL,
	`last_seen_at` integer NOT NULL,
	`disconnected_at` integer,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`room_id`) REFERENCES `rooms`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `seats_room_player_idx` ON `seats` (`room_id`,`player_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `seats_room_position_idx` ON `seats` (`room_id`,`position`);