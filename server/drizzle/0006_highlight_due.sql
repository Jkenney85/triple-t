ALTER TABLE `columns` ADD `highlight_due` integer DEFAULT true NOT NULL;--> statement-breakpoint
UPDATE `columns` SET `highlight_due` = 0 WHERE lower(`name`) LIKE '%needs recording%';
