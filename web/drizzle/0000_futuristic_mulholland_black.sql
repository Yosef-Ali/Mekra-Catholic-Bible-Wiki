CREATE TABLE "books" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" varchar(255) NOT NULL,
	"amharic_name" varchar(255) NOT NULL,
	"chapters" integer NOT NULL,
	"section" varchar(50) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "chapter_contents" (
	"id" serial PRIMARY KEY NOT NULL,
	"book_id" integer NOT NULL,
	"chapter_number" integer NOT NULL,
	"content" text NOT NULL,
	"verified" integer DEFAULT 0,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
ALTER TABLE "chapter_contents" ADD CONSTRAINT "chapter_contents_book_id_books_id_fk" FOREIGN KEY ("book_id") REFERENCES "public"."books"("id") ON DELETE no action ON UPDATE no action;