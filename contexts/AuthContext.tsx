import React from 'react';

// Auth has been removed. Everyone is a guest. This stub keeps the existing
// useAuth() call sites compiling without bringing back Firebase or any
// third-party auth provider. Add Better Auth (or similar) later if you need
// real sign-in / cross-device sync.

interface GuestAuth {
  user: null;
  dbUser: null;
  isAdmin: false;
  loading: false;
  signOut: () => Promise<void>;
}

const guestAuth: GuestAuth = {
  user: null,
  dbUser: null,
  isAdmin: false,
  loading: false,
  signOut: async () => {},
};

export const useAuth = (): GuestAuth => guestAuth;

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  return <>{children}</>;
};

