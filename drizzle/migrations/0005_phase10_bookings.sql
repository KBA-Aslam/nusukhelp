CREATE TABLE `audit_log` (
	`id` text PRIMARY KEY NOT NULL,
	`actor_id` text,
	`action` text NOT NULL,
	`entity_type` text NOT NULL,
	`entity_id` text NOT NULL,
	`changes` text,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`actor_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `idx_audit_entity` ON `audit_log` (`entity_type`,`entity_id`);--> statement-breakpoint
CREATE INDEX `idx_audit_created` ON `audit_log` (`created_at`);--> statement-breakpoint
CREATE TABLE `booking_counters` (
	`year` integer PRIMARY KEY NOT NULL,
	`last_sequence` integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE `booking_rooms` (
	`id` text PRIMARY KEY NOT NULL,
	`booking_id` text NOT NULL,
	`room_type_id` text,
	`room_type_name` text NOT NULL,
	`meal_plan_id` text,
	`meal_plan_code` text,
	`number_of_rooms` integer DEFAULT 1 NOT NULL,
	`number_of_guests` integer DEFAULT 1 NOT NULL,
	`nights` integer NOT NULL,
	`price_per_night` integer NOT NULL,
	`subtotal` integer NOT NULL,
	`sort_order` integer DEFAULT 0 NOT NULL,
	FOREIGN KEY (`booking_id`) REFERENCES `bookings`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`room_type_id`) REFERENCES `room_types`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`meal_plan_id`) REFERENCES `meal_plans`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_rooms_booking` ON `booking_rooms` (`booking_id`);--> statement-breakpoint
CREATE TABLE `booking_services` (
	`id` text PRIMARY KEY NOT NULL,
	`booking_id` text NOT NULL,
	`service_type_id` text,
	`service_name` text NOT NULL,
	`quantity` integer DEFAULT 1 NOT NULL,
	`unit_price` integer NOT NULL,
	`total` integer NOT NULL,
	`sort_order` integer DEFAULT 0 NOT NULL,
	FOREIGN KEY (`booking_id`) REFERENCES `bookings`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`service_type_id`) REFERENCES `service_types`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_services_booking` ON `booking_services` (`booking_id`);--> statement-breakpoint
CREATE TABLE `bookings` (
	`id` text PRIMARY KEY NOT NULL,
	`booking_number` text,
	`year` integer,
	`sequence` integer,
	`agency_id` text,
	`agency_name` text NOT NULL,
	`contact_person` text,
	`agency_mobile` text,
	`agency_whatsapp` text,
	`agency_email` text,
	`agency_country` text,
	`agency_address` text,
	`guest_name` text,
	`guest_mobile` text,
	`guest_email` text,
	`guest_country` text,
	`hotel_id` text,
	`hotel_name` text,
	`hotel_city` text,
	`hotel_category` text,
	`confirmation_number` text,
	`brn_vrn` text,
	`booking_source` text,
	`check_in_date` integer,
	`check_out_date` integer,
	`total_nights` integer DEFAULT 0 NOT NULL,
	`total_rooms` integer DEFAULT 0 NOT NULL,
	`total_guests` integer DEFAULT 0 NOT NULL,
	`booking_date` integer NOT NULL,
	`due_date` integer,
	`currency` text DEFAULT 'SAR' NOT NULL,
	`rooms_subtotal` integer DEFAULT 0 NOT NULL,
	`services_subtotal` integer DEFAULT 0 NOT NULL,
	`discount_amount` integer DEFAULT 0 NOT NULL,
	`vat_amount` integer DEFAULT 0 NOT NULL,
	`total_value` integer DEFAULT 0 NOT NULL,
	`amount_paid` integer DEFAULT 0 NOT NULL,
	`status` text DEFAULT 'draft' NOT NULL,
	`payment_status` text DEFAULT 'unpaid' NOT NULL,
	`notes` text,
	`terms` text,
	`cancel_reason` text,
	`created_by` text NOT NULL,
	`updated_by` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`confirmed_at` integer,
	`completed_at` integer,
	`cancelled_at` integer,
	FOREIGN KEY (`agency_id`) REFERENCES `agencies`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`hotel_id`) REFERENCES `hotels`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`created_by`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`updated_by`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `bookings_booking_number_unique` ON `bookings` (`booking_number`);--> statement-breakpoint
CREATE INDEX `idx_bk_status` ON `bookings` (`status`);--> statement-breakpoint
CREATE INDEX `idx_bk_payment_status` ON `bookings` (`payment_status`);--> statement-breakpoint
CREATE INDEX `idx_bk_checkin` ON `bookings` (`check_in_date`);--> statement-breakpoint
CREATE INDEX `idx_bk_checkout` ON `bookings` (`check_out_date`);--> statement-breakpoint
CREATE INDEX `idx_bk_booking_date` ON `bookings` (`booking_date`);--> statement-breakpoint
CREATE INDEX `idx_bk_agency` ON `bookings` (`agency_id`);--> statement-breakpoint
CREATE INDEX `idx_bk_year` ON `bookings` (`year`);--> statement-breakpoint
CREATE INDEX `idx_bk_confirmation` ON `bookings` (`confirmation_number`);--> statement-breakpoint
CREATE INDEX `idx_bk_brn` ON `bookings` (`brn_vrn`);--> statement-breakpoint
CREATE TABLE `payments` (
	`id` text PRIMARY KEY NOT NULL,
	`booking_id` text NOT NULL,
	`amount` integer NOT NULL,
	`paid_at` integer NOT NULL,
	`method_id` text,
	`method_name` text,
	`reference` text,
	`notes` text,
	`is_reversed` integer DEFAULT false NOT NULL,
	`reversed_at` integer,
	`reversed_by` text,
	`reverse_reason` text,
	`recorded_by` text NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`booking_id`) REFERENCES `bookings`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`method_id`) REFERENCES `payment_methods`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`reversed_by`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`recorded_by`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_payments_booking` ON `payments` (`booking_id`);