import { GoogleAuthProvider, onAuthStateChanged, signInWithCredential, signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut, type User } from 'firebase/auth';
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';

import { auth, firebaseConfigured } from '@/firebase';

type AuthValue = {
  user: User | null;
  loading: boolean;
  configured: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string) => Promise<void>;
  logOut: () => Promise<void>;
  signInWithGoogle: (idToken: string, accessToken?: string) => Promise<void>;
};

const AuthContext = createContext<AuthValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(firebaseConfigured);

  useEffect(() => {
    if (!auth) return;
    return onAuthStateChanged(auth, nextUser => {
      setUser(nextUser);
      setLoading(false);
    });
  }, []);

  const value: AuthValue = {
    user,
    loading,
    configured: firebaseConfigured,
    signIn: async (email, password) => {
      if (!auth) throw new Error('Firebase authentication is not configured');
      await signInWithEmailAndPassword(auth, email.trim(), password);
    },
    register: async (email, password) => {
      if (!auth) throw new Error('Firebase authentication is not configured');
      await createUserWithEmailAndPassword(auth, email.trim(), password);
    },
    logOut: async () => {
      if (auth) await signOut(auth);
    },
    signInWithGoogle: async (idToken, accessToken) => {
      if (!auth) throw new Error('Firebase authentication is not configured');
      const credential = GoogleAuthProvider.credential(idToken, accessToken);
      await signInWithCredential(auth, credential);
    },
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) throw new Error('useAuth must be used inside AuthProvider');
  return value;
}
