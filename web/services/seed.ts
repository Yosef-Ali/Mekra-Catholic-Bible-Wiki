import { db } from "./db";
import { books } from "./schema";
import { CATHOLIC_BOOKS } from "../constants";

async function seed() {
  console.log("🌱 Seeding database...");

  try {
    // Optional: Clear existing data
    // await db.delete(books); 

    console.log(`Found ${CATHOLIC_BOOKS.length} books to seed.`);

    // Insert books in batches or one by one
    for (const book of CATHOLIC_BOOKS) {
      await db.insert(books).values({
        name: book.name,
        amharicName: book.amharicName,
        chapters: book.chapters,
        section: book.section,
      });
    }

    console.log("✅ Seeding completed successfully!");
    process.exit(0);
  } catch (error) {
    console.error("❌ Seeding failed:", error);
    process.exit(1);
  }
}

seed();
