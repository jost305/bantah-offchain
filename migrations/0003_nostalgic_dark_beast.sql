CREATE TABLE "treasury_wallet_transactions" (
	"id" serial PRIMARY KEY NOT NULL,
	"admin_id" varchar NOT NULL,
	"type" varchar NOT NULL,
	"amount" numeric(15, 2) NOT NULL,
	"description" text,
	"related_match_id" integer,
	"related_challenge_id" integer,
	"reference" varchar,
	"status" varchar DEFAULT 'completed',
	"balance_before" numeric(15, 2),
	"balance_after" numeric(15, 2),
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "treasury_wallets" (
	"id" serial PRIMARY KEY NOT NULL,
	"admin_id" varchar NOT NULL,
	"balance" numeric(15, 2) DEFAULT '0.00',
	"total_deposited" numeric(15, 2) DEFAULT '0.00',
	"total_used" numeric(15, 2) DEFAULT '0.00',
	"total_earned" numeric(15, 2) DEFAULT '0.00',
	"status" varchar DEFAULT 'active',
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "treasury_wallets_admin_id_unique" UNIQUE("admin_id")
);
--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "is_admin_generated" boolean DEFAULT false;