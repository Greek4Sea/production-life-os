CREATE TABLE "api_tokens" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"token_hash" text NOT NULL,
	"last_used_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "api_tokens_token_hash_unique" UNIQUE("token_hash")
);
--> statement-breakpoint
CREATE TABLE "mod_canvas_announcements" (
	"id" text PRIMARY KEY NOT NULL,
	"course_id" text NOT NULL,
	"title" text NOT NULL,
	"message" text,
	"posted_at" timestamp with time zone,
	"html_url" text
);
--> statement-breakpoint
CREATE TABLE "mod_canvas_assignments" (
	"id" text PRIMARY KEY NOT NULL,
	"course_id" text NOT NULL,
	"name" text NOT NULL,
	"due_at" timestamp with time zone,
	"points_possible" double precision,
	"html_url" text,
	"description" text,
	"submitted" boolean DEFAULT false NOT NULL,
	"muted" boolean DEFAULT false NOT NULL,
	"score" double precision,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "mod_canvas_courses" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"code" text,
	"grade" text,
	"score" double precision,
	"term" text,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "mod_comp_events" (
	"uid" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"kind" text NOT NULL,
	"age_category" text,
	"city" text,
	"state" text,
	"start_date" date NOT NULL,
	"end_date" date NOT NULL,
	"reg_closes" timestamp with time zone,
	"url" text,
	"source" text NOT NULL,
	"first_seen" timestamp with time zone DEFAULT now() NOT NULL,
	"last_seen" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "day_items" (
	"id" text PRIMARY KEY NOT NULL,
	"date" date NOT NULL,
	"module_id" text NOT NULL,
	"kind" text NOT NULL,
	"time" timestamp with time zone,
	"end_time" timestamp with time zone,
	"title" text NOT NULL,
	"subtitle" text,
	"url" text,
	"payload" jsonb,
	"status" text DEFAULT 'pending' NOT NULL,
	"external_id" text,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "events" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"ts" timestamp with time zone DEFAULT now() NOT NULL,
	"module_id" text NOT NULL,
	"type" text NOT NULL,
	"payload" jsonb
);
--> statement-breakpoint
CREATE TABLE "mod_farm_state" (
	"id" text PRIMARY KEY NOT NULL,
	"version" integer NOT NULL,
	"state" jsonb NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "mod_fencing_ratings" (
	"weapon" text PRIMARY KEY NOT NULL,
	"rating" text NOT NULL,
	"earned_at" date,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "mod_fencing_results" (
	"uid" text PRIMARY KEY NOT NULL,
	"date" date NOT NULL,
	"tournament" text NOT NULL,
	"event" text NOT NULL,
	"place" integer,
	"field_size" integer,
	"rating_earned" text,
	"event_class" text,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "mod_fitness_days" (
	"date" date PRIMARY KEY NOT NULL,
	"eaten" integer DEFAULT 0 NOT NULL,
	"burned" integer DEFAULT 0 NOT NULL,
	"streak" integer DEFAULT 0 NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "mod_gcal_calendars" (
	"id" text PRIMARY KEY NOT NULL,
	"summary" text NOT NULL,
	"color" text,
	"primary" boolean DEFAULT false NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "mod_gmail_messages" (
	"id" text PRIMARY KEY NOT NULL,
	"thread_id" text NOT NULL,
	"from_addr" text NOT NULL,
	"subject" text,
	"snippet" text,
	"category" text NOT NULL,
	"summary" text,
	"unread" boolean DEFAULT true NOT NULL,
	"received_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "google_tokens" (
	"id" text PRIMARY KEY DEFAULT 'default' NOT NULL,
	"email" text NOT NULL,
	"refresh_token" text NOT NULL,
	"scopes" text,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "module_settings" (
	"module_id" text PRIMARY KEY NOT NULL,
	"data" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "notifications" (
	"id" text PRIMARY KEY NOT NULL,
	"module_id" text NOT NULL,
	"title" text NOT NULL,
	"body" text,
	"url" text,
	"scheduled_for" timestamp with time zone NOT NULL,
	"status" text DEFAULT 'scheduled' NOT NULL,
	"sent_at" timestamp with time zone,
	"dedupe_key" text,
	"read_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "notifications_dedupe_key_unique" UNIQUE("dedupe_key")
);
--> statement-breakpoint
CREATE TABLE "push_subscriptions" (
	"id" text PRIMARY KEY NOT NULL,
	"endpoint" text NOT NULL,
	"p256dh" text NOT NULL,
	"auth" text NOT NULL,
	"user_agent" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "push_subscriptions_endpoint_unique" UNIQUE("endpoint")
);
--> statement-breakpoint
CREATE TABLE "mod_recipes" (
	"id" text PRIMARY KEY NOT NULL,
	"title" text NOT NULL,
	"servings" integer,
	"time_min" integer,
	"calories" integer,
	"tags" jsonb DEFAULT '[]'::jsonb,
	"ingredients" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"steps" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"lighter" jsonb DEFAULT '[]'::jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "mod_spotify_tokens" (
	"id" text PRIMARY KEY DEFAULT 'default' NOT NULL,
	"refresh_token" text NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sync_state" (
	"module_id" text PRIMARY KEY NOT NULL,
	"last_run_at" timestamp with time zone,
	"last_ok_at" timestamp with time zone,
	"cursor" jsonb,
	"last_error" text
);
--> statement-breakpoint
CREATE TABLE "mod_tasks" (
	"id" text PRIMARY KEY NOT NULL,
	"title" text NOT NULL,
	"due" timestamp with time zone,
	"all_day" boolean DEFAULT false NOT NULL,
	"repeat_days" integer,
	"done" boolean DEFAULT false NOT NULL,
	"done_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "canvas_assignments_due" ON "mod_canvas_assignments" USING btree ("due_at");--> statement-breakpoint
CREATE INDEX "comp_events_start" ON "mod_comp_events" USING btree ("start_date");--> statement-breakpoint
CREATE UNIQUE INDEX "day_items_module_external" ON "day_items" USING btree ("module_id","external_id");--> statement-breakpoint
CREATE INDEX "day_items_date" ON "day_items" USING btree ("date");--> statement-breakpoint
CREATE INDEX "fencing_results_date" ON "mod_fencing_results" USING btree ("date");--> statement-breakpoint
CREATE INDEX "gmail_messages_received" ON "mod_gmail_messages" USING btree ("received_at");--> statement-breakpoint
CREATE INDEX "tasks_due" ON "mod_tasks" USING btree ("due");