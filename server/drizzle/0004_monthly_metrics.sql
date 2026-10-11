PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_video_values` (
	`video_id` integer NOT NULL,
	`field_id` integer NOT NULL,
	`month` text NOT NULL,
	`value` text NOT NULL,
	PRIMARY KEY(`video_id`, `field_id`, `month`),
	FOREIGN KEY (`video_id`) REFERENCES `videos`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`field_id`) REFERENCES `fields`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
INSERT INTO `__new_video_values`("video_id", "field_id", "month", "value") SELECT vv."video_id", vv."field_id", strftime('%Y-%m', v."updated_at" / 1000, 'unixepoch'), vv."value" FROM `video_values` vv JOIN `videos` v ON v."id" = vv."video_id";--> statement-breakpoint
DROP TABLE `video_values`;--> statement-breakpoint
ALTER TABLE `__new_video_values` RENAME TO `video_values`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE INDEX `video_values_field_idx` ON `video_values` (`field_id`);