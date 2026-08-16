CREATE TABLE `company_settings` (
	`id` integer PRIMARY KEY DEFAULT 1 NOT NULL,
	`legal_name` text NOT NULL,
	`trading_name` text,
	`cr_number` text,
	`address_line1` text,
	`address_line2` text,
	`city` text DEFAULT 'Madinah Al Munawarah',
	`country` text DEFAULT 'Saudi Arabia',
	`phone_primary` text,
	`phone_secondary` text,
	`whatsapp` text,
	`email` text,
	`website` text,
	`bank_name` text,
	`bank_account_name` text,
	`bank_iban` text,
	`number_prefix` text DEFAULT 'AHR' NOT NULL,
	`default_terms` text,
	`prepared_by_label` text,
	`approved_by_name` text,
	`logo_url` text,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `enquiries` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`email` text NOT NULL,
	`phone` text,
	`company` text,
	`audience` text DEFAULT 'pilgrim' NOT NULL,
	`service_interest` text,
	`message` text NOT NULL,
	`locale` text DEFAULT 'en' NOT NULL,
	`status` text DEFAULT 'new' NOT NULL,
	`ip_hash` text,
	`created_at` integer NOT NULL,
	`handled_by` text,
	`handled_at` integer
);
--> statement-breakpoint
CREATE INDEX `idx_enquiries_status` ON `enquiries` (`status`);--> statement-breakpoint
CREATE TABLE `reviews` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`email` text NOT NULL,
	`rating` integer NOT NULL,
	`comment` text NOT NULL,
	`service_used` text,
	`country` text,
	`status` text DEFAULT 'pending' NOT NULL,
	`ip_hash` text,
	`locale` text DEFAULT 'en' NOT NULL,
	`created_at` integer NOT NULL,
	`reviewed_at` integer,
	`reviewed_by` text
);
--> statement-breakpoint
CREATE INDEX `idx_reviews_status` ON `reviews` (`status`);--> statement-breakpoint
CREATE INDEX `idx_reviews_created` ON `reviews` (`created_at`);