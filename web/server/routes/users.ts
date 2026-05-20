import express, { Request, Response } from 'express';
import { db } from '../../services/db';
import { users } from '../../services/schema';
import { eq, desc } from 'drizzle-orm';

const router = express.Router();

// Middleware to check if user is admin (simplified for now, relies on client sending firebaseUid)
// In a production app, verify Firebase ID token on server
const isAdmin = async (req: Request, res: Response, next: express.NextFunction) => {
  const firebaseUid = req.headers['x-firebase-uid'] as string;
  if (!firebaseUid) {
    return res.status(401).json({ success: false, error: 'Unauthorized' });
  }

  try {
    const user = await db.select().from(users).where(eq(users.firebaseUid, firebaseUid)).limit(1);

    // First user is always admin (bootstrap)
    const allUsers = await db.select().from(users);
    if (allUsers.length === 1 && user.length === 1) {
      // If this is the only user, treat as admin to allow bootstrapping
      return next();
    }

    if (!user.length || user[0].role !== 'admin') {
      return res.status(403).json({ success: false, error: 'Forbidden: Admin access required' });
    }
    next();
  } catch (error) {
    console.error('Auth check failed:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
};

// Sync user from Firebase (create or update)
router.post('/sync', async (req, res) => {
  const { firebaseUid, email, phoneNumber, displayName, photoUrl, authProvider } = req.body;

  if (!firebaseUid) {
    return res.status(400).json({ success: false, error: 'Missing firebaseUid' });
  }

  try {
    const existingUser = await db.select().from(users).where(eq(users.firebaseUid, firebaseUid)).limit(1);

    if (existingUser.length > 0) {
      // Update existing user
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
      return res.json({ success: true, user: updated[0] });
    } else {
      // Create new user
      // If this is the very first user, make them admin
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

      return res.json({ success: true, user: newUser[0] });
    }
  } catch (error: any) {
    console.error('User sync failed:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get all users (Admin only)
router.get('/', isAdmin, async (req, res) => {
  try {
    const allUsers = await db.select().from(users).orderBy(desc(users.lastLoginAt));
    res.json({ success: true, users: allUsers });
  } catch (error: any) {
    console.error('Fetch users failed:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Update user role (Admin only)
router.put('/:userId/role', isAdmin, async (req, res) => {
  const { userId } = req.params;
  const { role } = req.body;

  if (!['user', 'admin'].includes(role)) {
    return res.status(400).json({ success: false, error: 'Invalid role' });
  }

  try {
    // Prevent removing own admin status if unique admin (optional safety check, skip for now to keep simple)
    await db.update(users)
      .set({ role })
      .where(eq(users.id, parseInt(userId)));

    res.json({ success: true, message: 'Role updated successfully' });
  } catch (error: any) {
    console.error('Update role failed:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;
