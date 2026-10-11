ALTER TABLE `comments` ADD `video_id` integer REFERENCES videos(id) ON DELETE cascade;--> statement-breakpoint
CREATE INDEX `comments_video_idx` ON `comments` (`video_id`);