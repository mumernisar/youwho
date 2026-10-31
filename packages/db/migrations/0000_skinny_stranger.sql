CREATE TABLE "confirmations" (
	"dataset_id" uuid NOT NULL,
	"voter_hash" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "confirmations_dataset_id_voter_hash_pk" PRIMARY KEY("dataset_id","voter_hash")
);
--> statement-breakpoint
CREATE TABLE "datasets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" text NOT NULL,
	"label" text NOT NULL,
	"source_url" text NOT NULL,
	"stamp" text NOT NULL,
	"meta" jsonb NOT NULL,
	"data_hash" text NOT NULL,
	"logic_hash" text NOT NULL,
	"decoder_known" boolean NOT NULL,
	"warnings" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"students_count" integer NOT NULL,
	"seats_count" integer NOT NULL,
	"confirm_count" integer DEFAULT 0 NOT NULL,
	"report_count" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "datasets_slug_unique" UNIQUE("slug"),
	CONSTRAINT "datasets_source_url_unique" UNIQUE("source_url")
);
--> statement-breakpoint
CREATE TABLE "jobs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"source_url" text NOT NULL,
	"kind" text NOT NULL,
	"dataset_id" uuid,
	"status" text DEFAULT 'queued' NOT NULL,
	"stage" text DEFAULT 'queued' NOT NULL,
	"error_code" text,
	"error_message" text,
	"requester_hash" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"started_at" timestamp with time zone,
	"heartbeat_at" timestamp with time zone,
	"finished_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "rate_limits" (
	"key" text NOT NULL,
	"window_start" timestamp with time zone NOT NULL,
	"count" integer NOT NULL,
	CONSTRAINT "rate_limits_key_window_start_pk" PRIMARY KEY("key","window_start")
);
--> statement-breakpoint
CREATE TABLE "reports" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"dataset_id" uuid NOT NULL,
	"reason" text NOT NULL,
	"note" text,
	"voter_hash" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "scraper_status" (
	"id" smallint PRIMARY KEY DEFAULT 1 NOT NULL,
	"last_seen_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "seats" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"dataset_id" uuid NOT NULL,
	"reg" text NOT NULL,
	"slot_key" text NOT NULL,
	"end_time" text NOT NULL,
	"course" smallint NOT NULL,
	"section" smallint NOT NULL,
	"room" text NOT NULL,
	"pos_kind" text NOT NULL,
	"row" smallint,
	"col" smallint,
	"label" text
);
--> statement-breakpoint
CREATE TABLE "students" (
	"dataset_id" uuid NOT NULL,
	"reg" text NOT NULL,
	"name" text NOT NULL,
	"home_section" smallint NOT NULL,
	CONSTRAINT "students_dataset_id_reg_pk" PRIMARY KEY("dataset_id","reg")
);
--> statement-breakpoint
ALTER TABLE "confirmations" ADD CONSTRAINT "confirmations_dataset_id_datasets_id_fk" FOREIGN KEY ("dataset_id") REFERENCES "public"."datasets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "jobs" ADD CONSTRAINT "jobs_dataset_id_datasets_id_fk" FOREIGN KEY ("dataset_id") REFERENCES "public"."datasets"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reports" ADD CONSTRAINT "reports_dataset_id_datasets_id_fk" FOREIGN KEY ("dataset_id") REFERENCES "public"."datasets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "seats" ADD CONSTRAINT "seats_dataset_id_datasets_id_fk" FOREIGN KEY ("dataset_id") REFERENCES "public"."datasets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "students" ADD CONSTRAINT "students_dataset_id_datasets_id_fk" FOREIGN KEY ("dataset_id") REFERENCES "public"."datasets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "jobs_active_url_idx" ON "jobs" USING btree ("source_url") WHERE "jobs"."status" in ('queued', 'running');--> statement-breakpoint
CREATE INDEX "jobs_status_created_idx" ON "jobs" USING btree ("status","created_at");--> statement-breakpoint
CREATE INDEX "reports_dataset_idx" ON "reports" USING btree ("dataset_id","created_at");--> statement-breakpoint
CREATE INDEX "seats_room_idx" ON "seats" USING btree ("dataset_id","slot_key","room");--> statement-breakpoint
CREATE INDEX "seats_reg_idx" ON "seats" USING btree ("reg");--> statement-breakpoint
CREATE INDEX "students_reg_idx" ON "students" USING btree ("reg");