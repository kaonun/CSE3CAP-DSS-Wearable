import { getApp, getApps, initializeApp } from 'firebase/app';
import { getAuth, initializeAuth, type Auth } from 'firebase/auth';
// @ts-expect-error - getReactNativePersistence exists in firebase/auth's React Native
// build at runtime but is missing from its published web-oriented .d.ts (firebase/firebase-js-sdk#9316).
import { getReactNativePersistence } from 'firebase/auth';
import * as SecureStore from 'expo-secure-store';

const config = {
  apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID,
};

export const firebaseConfigured = Object.values(config).every(Boolean);

// Keystore/Keychain-backed persistence — session tokens must never sit in
// AsyncStorage (see DSS Wearable App security must-dos, Data Storage §2).
const secureStorePersistence = {
  getItem: (key: string) => SecureStore.getItemAsync(key),
  setItem: (key: string, value: string) => SecureStore.setItemAsync(key, value),
  removeItem: (key: string) => SecureStore.deleteItemAsync(key),
};

let auth: Auth | null = null;
if (firebaseConfigured) {
  const app = getApps().length ? getApp() : initializeApp(config);
  try {
    auth = initializeAuth(app, { persistence: getReactNativePersistence(secureStorePersistence) });
  } catch {
    // initializeAuth throws if it (or getAuth) already ran on this app instance,
    // e.g. during Fast Refresh — fall back to the existing instance.
    auth = getAuth(app);
  }
}

export { auth };
