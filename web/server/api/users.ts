
import { db } from '../../services/db';
import { users } from '../../services/schema';
import { eq, desc } from 'drizzle-orm';

// Sync user from Firebase
export async function syncUser(userData: {
  firebaseUid: string;
  email: string | null;
  phoneNumber: string | null;
  displayName: string | null;
  photoUrl: string | null;
  authProvider: string;
}) {
  const { firebaseUid, email, phoneNumber, displayName, photoUrl, authProvider } = userData;

  // Simple validation
  if (!firebaseUid) {
    throw new Error('Missing firebaseUid');
  }

  const existingUser = await db.select().from(users).where(eq(users.firebaseUid, firebaseUid)).limit(1);

  if (existingUser.length > 0) {
    // Update existing
    await db.update(users)
      .set({
        email,
        phoneNumber,
        displayName,
        photoUrl,
        lastLoginAt: new Date()
      })
      .where(eq(users.firebaseUid, firebaseUid));

    const updated = await db.select().from(users).where(eq(users.firebaseUid, firebaseUid)).limit(1);
    return { success: true, user: updated[0] };
  } else {
    // Create new
    const allUsersCount = await db.select({ id: users.id }).from(users);
    const role = allUsersCount.length === 0 ? 'admin' : 'user';

    const newUser = await db.insert(users).values({
      firebaseUid,
      email,
      phoneNumber,
      displayName,
      photoUrl,
      authProvider,
      role,
      createdAt: new Date(),
      lastLoginAt: new Date()
    }).returning();

    return { success: true, user: newUser[0] };
  }
}

// Get all users
export async function getAllUsers() {
  const allUsers = await db.select().from(users).orderBy(desc(users.lastLoginAt));
  return { success: true, users: allUsers };
}

// Update user role
export async function updateUserRole(userId: number, role: 'admin' | 'user') {
  if (!['user', 'admin'].includes(role)) {
    throw new Error('Invalid role');
  }

  await db.update(users)
    .set({ role })
    .where(eq(users.id, userId));

  return { success: true, message: 'Role updated successfully' };
}

// Check if user is admin (helper for middleware)
export async function isUserAdmin(firebaseUid: string) {
  if (!firebaseUid) return false;
  const user = await db.select().from(users).where(eq(users.firebaseUid, firebaseUid)).limit(1);
  return user.length > 0 && user[0].role === 'admin';
}
