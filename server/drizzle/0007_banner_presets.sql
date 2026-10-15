CREATE TABLE `banner_presets` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`board_id` integer NOT NULL,
	`color` text NOT NULL,
	`text` text NOT NULL,
	FOREIGN KEY (`board_id`) REFERENCES `boards`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `banner_presets_board_color_unique` ON `banner_presets` (`board_id`,`color`);