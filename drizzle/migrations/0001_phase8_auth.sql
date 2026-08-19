-- Phase 8 — auth (SPEC §12) and the two foreign keys deferred out of Phase 2
-- (SPEC §8, *Deferred constraints*).
--
-- Hand-edited after `drizzle-kit generate` in exactly one way: the
-- `PRAGMA foreign_keys=OFF` / `ON` pair drizzle wraps a SQLite table rebuild in
-- has been removed. D1 does not accept it — foreign key enforcement is the
-- platform's to control, not a statement's — and nothing here needs it. The
-- rebuilds are ordered after `CREATE TABLE user`, so the new constraint's
-- parent exists before any row is copied, and no table references `reviews` or
-- `enquiries`, so dropping them breaks nothing on the way through.
--
-- Both tables are rebuilt rather than altered because SQLite cannot add a
-- foreign key to an existing column: new table, INSERT … SELECT, drop, rename,
-- recreate the indexes.

CREATE TABLE `account` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`issuer` text NOT NULL,
	`account_id` text NOT NULL,
	`provider_id` text NOT NULL,
	`password` text,
	`access_token` text,
	`refresh_token` text,
	`id_token` text,
	`access_token_expires_at` integer,
	`refresh_token_expires_at` integer,
	`scope` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_account_user` ON `account` (`user_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `idx_account_issuer_account` ON `account` (`issuer`,`account_id`);--> statement-breakpoint
CREATE TABLE `admin_invites` (
	`id` text PRIMARY KEY NOT NULL,
	`email` text NOT NULL,
	`name` text NOT NULL,
	`role` text DEFAULT 'executive' NOT NULL,
	`token_hash` text NOT NULL,
	`invited_by` text NOT NULL,
	`expires_at` integer NOT NULL,
	`accepted_at` integer,
	`revoked_at` integer,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`invited_by`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `admin_invites_token_hash_unique` ON `admin_invites` (`token_hash`);--> statement-breakpoint
CREATE INDEX `idx_invites_email` ON `admin_invites` (`email`);--> statement-breakpoint
CREATE TABLE `login_attempts` (
	`ip_hash` text PRIMARY KEY NOT NULL,
	`count` integer DEFAULT 0 NOT NULL,
	`window_start` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `session` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`token` text NOT NULL,
	`expires_at` integer NOT NULL,
	`ip_address` text,
	`user_agent` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `session_token_unique` ON `session` (`token`);--> statement-breakpoint
CREATE INDEX `idx_session_user` ON `session` (`user_id`);--> statement-breakpoint
CREATE TABLE `user` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`email` text NOT NULL,
	`email_verified` integer DEFAULT false NOT NULL,
	`image` text,
	`role` text DEFAULT 'executive' NOT NULL,
	`is_active` integer DEFAULT true NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `user_email_unique` ON `user` (`email`);--> statement-breakpoint
CREATE TABLE `verification` (
	`id` text PRIMARY KEY NOT NULL,
	`identifier` text NOT NULL,
	`value` text NOT NULL,
	`expires_at` integer NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_verification_identifier` ON `verification` (`identifier`);--> statement-breakpoint
CREATE TABLE `__new_enquiries` (
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
	`handled_at` integer,
	FOREIGN KEY (`handled_by`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
INSERT INTO `__new_enquiries`("id", "name", "email", "phone", "company", "audience", "service_interest", "message", "locale", "status", "ip_hash", "created_at", "handled_by", "handled_at") SELECT "id", "name", "email", "phone", "company", "audience", "service_interest", "message", "locale", "status", "ip_hash", "created_at", "handled_by", "handled_at" FROM `enquiries`;--> statement-breakpoint
DROP TABLE `enquiries`;--> statement-breakpoint
ALTER TABLE `__new_enquiries` RENAME TO `enquiries`;--> statement-breakpoint
CREATE INDEX `idx_enquiries_status` ON `enquiries` (`status`);--> statement-breakpoint
CREATE TABLE `__new_reviews` (
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
	`reviewed_by` text,
	FOREIGN KEY (`reviewed_by`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
INSERT INTO `__new_reviews`("id", "name", "email", "rating", "comment", "service_used", "country", "status", "ip_hash", "locale", "created_at", "reviewed_at", "reviewed_by") SELECT "id", "name", "email", "rating", "comment", "service_used", "country", "status", "ip_hash", "locale", "created_at", "reviewed_at", "reviewed_by" FROM `reviews`;--> statement-breakpoint
DROP TABLE `reviews`;--> statement-breakpoint
ALTER TABLE `__new_reviews` RENAME TO `reviews`;--> statement-breakpoint
CREATE INDEX `idx_reviews_status` ON `reviews` (`status`);--> statement-breakpoint
CREATE INDEX `idx_reviews_created` ON `reviews` (`created_at`);