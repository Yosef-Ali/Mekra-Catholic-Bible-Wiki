import { drizzle } from "drizzle-orm/neon-http";
import { neon } from "@neondatabase/serverless";
import * as dotenv from "dotenv";

// Load environment variables
dotenv.config();

/**
 * SECURITY NOTE:
 * This file contains database connection logic and should ONLY be used server-side.
 * Never import this file in client/browser code.
 *
 * Client code should use the API endpoints:
 * - GET /api/books
 * - GET /api/books/:id
 * - GET /api/books/section/:section
 */

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error(
    "❌ DATABASE_URL is not defined in your environment variables.\n" +
    "Please add it to your .env file:\n" +
    "DATABASE_URL=postgresql://user:password@host/database"
  );
}

// Create Neon HTTP client (optimized for serverless/edge environments).
// Exported for scripts that need raw tagged-template SQL (TRUNCATE, bulk
// unnest, etc.) which Drizzle doesn't expose directly.
export const sql = neon(connectionString);

import * as schema from "./schema";

// Create and export Drizzle ORM instance
export const db = drizzle(sql, { schema });

console.log("✅ Database connection initialized successfully");
