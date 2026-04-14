ALTER TABLE "households" ADD COLUMN "default_currency" text DEFAULT 'IRR' NOT NULL;--> statement-breakpoint
ALTER TABLE "transactions" ADD COLUMN "currency" text DEFAULT 'IRR' NOT NULL;