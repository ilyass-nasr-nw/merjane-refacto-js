CREATE TABLE IF NOT EXISTS "orders" (
	"id" serial PRIMARY KEY NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "orders_to_products" (
	"order_id" integer NOT NULL,
	"product_id" integer NOT NULL,
	CONSTRAINT "orders_to_products_order_id_product_id_pk" PRIMARY KEY("order_id","product_id")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "products" (
	"id" serial PRIMARY KEY NOT NULL,
	"lead_time" integer NOT NULL,
	"available" integer NOT NULL,
	"type" varchar(256) NOT NULL,
	"name" varchar(256) NOT NULL,
	"expiry_date" date,
	"season_start_date" date,
	"season_end_date" date
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "orders_to_products" ADD CONSTRAINT "orders_to_products_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "orders_to_products" ADD CONSTRAINT "orders_to_products_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
