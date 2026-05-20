
import * as dotenv from "dotenv";
import { drizzle } from "drizzle-orm/neon-http";
import { neon } from "@neondatabase/serverless";
import { books } from "../services/schema";
import { eq } from "drizzle-orm";

dotenv.config();

const updates = [
  { name: "Genesis", image: "/hero-images/Genesis.jpg" },
  { name: "Exodus", image: "/hero-images/Exodus.jpg" },
  { name: "Leviticus", image: "/hero-images/Leviticus.jpg" },
  { name: "Numbers", image: "/hero-images/Numbers.jpg" },
  { name: "Deuteronomy", image: "/hero-images/Deuteronomy.jpg" },
  { name: "Joshua", image: "/hero-images/Joshua.jpg" },
];

async function updateHeroImages() {
  console.log("Updating hero images...");
  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) {
    console.error("DATABASE_URL not found");
    process.exit(1);
  }

  const sql = neon(dbUrl);
  const db = drizzle(sql);

  for (const update of updates) {
    try {
      await db
        .update(books)
        .set({ heroImage: update.image })
        .where(eq(books.name, update.name));
      console.log(`✅ Updated ${update.name} to ${update.image}`);
    } catch (error) {
      console.error(`❌ Failed to update ${update.name}:`, error);
    }
  }

  console.log("Done!");
  process.exit(0);
}

updateHeroImages();
