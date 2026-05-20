
import * as dotenv from "dotenv";
import { drizzle } from "drizzle-orm/neon-http";
import { neon } from "@neondatabase/serverless";
import { books } from "../services/schema";
import { eq } from "drizzle-orm";

dotenv.config();

async function fixRuthImage() {
  console.log("Fixing Ruth image assignment...");
  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) {
    console.error("DATABASE_URL not found");
    process.exit(1);
  }

  const sql = neon(dbUrl);
  const db = drizzle(sql);

  try {
    // 1. Assign the image to Ruth
    await db
      .update(books)
      .set({ heroImage: "/hero-images/Ruth.jpg" })
      .where(eq(books.name, "Ruth"));
    console.log("✅ Updated Ruth to use /hero-images/Ruth.jpg");

    // 2. Clear the image for Exodus (since we moved its file)
    await db
      .update(books)
      .set({ heroImage: null })
      .where(eq(books.name, "Exodus"));
    console.log("✅ Cleared hero image for Exodus (file moved to Ruth)");

  } catch (error) {
    console.error("❌ Failed to update records:", error);
    process.exit(1);
  }

  console.log("Done!");
  process.exit(0);
}

fixRuthImage();
