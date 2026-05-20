
import * as dotenv from "dotenv";
import { drizzle } from "drizzle-orm/neon-http";
import { neon } from "@neondatabase/serverless";
import { books } from "../services/schema";
import { eq } from "drizzle-orm";

dotenv.config();

async function updateExodusImage() {
  console.log("Updating Exodus image...");
  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) {
    console.error("DATABASE_URL not found");
    process.exit(1);
  }

  const sql = neon(dbUrl);
  const db = drizzle(sql);

  try {
    await db
      .update(books)
      .set({ heroImage: "/hero-images/Exodus.jpg" })
      .where(eq(books.name, "Exodus"));
    console.log("✅ Updated Exodus to use /hero-images/Exodus.jpg");
  } catch (error) {
    console.error("❌ Failed to update Exodus:", error);
    process.exit(1);
  }

  console.log("Done!");
  process.exit(0);
}

updateExodusImage();
