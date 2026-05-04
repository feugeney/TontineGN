ALTER TABLE "otp_codes" ALTER COLUMN "phone" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "otp_codes" ADD COLUMN IF NOT EXISTS "email" text;