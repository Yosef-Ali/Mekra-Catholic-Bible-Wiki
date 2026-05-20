
import { db } from '../services/db';
import { users } from '../services/schema';
import { eq } from 'drizzle-orm';
import dotenv from 'dotenv';
import path from 'path';

// Load env vars
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

async function makeAdmin(email: string) {
  console.log(`🔍 Looking for user with email: ${email}`);

  try {
    const user = await db.select().from(users).where(eq(users.email, email));

    if (user.length === 0) {
      console.error('❌ User not found!');
      process.exit(1);
    }

    console.log(`👤 Found user: ${user[0].displayName} (Current Role: ${user[0].role})`);

    if (user[0].role === 'admin') {
      console.log('✅ User is already an admin.');
      process.exit(0);
    }

    await db.update(users)
      .set({ role: 'admin' })
      .where(eq(users.email, email));

    console.log('🎉 Successfully promoted user to ADMIN!');
  } catch (error) {
    console.error('❌ Error updating user:', error);
  } finally {
    process.exit(0);
  }
}

const targetEmail = process.argv[2] || 'dev.yosefali@gmail.com'; // Default from screenshot
makeAdmin(targetEmail);
