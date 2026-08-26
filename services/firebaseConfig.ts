import * as SecureStore from "expo-secure-store";
import { getApp, getApps, initializeApp } from "firebase/app";
import { getAuth, initializeAuth, type Auth } from "firebase/auth";
// @ts-expect-error - getReactNativePersistence exists in firebase/auth's React Native
// build at runtime but is missing from its published web-oriented .d.ts (firebase/firebase-js-sdk#9316).
import { getReactNativePersistence } from "firebase/auth";
import {
  getFirestore,
  initializeFirestore,
  type Firestore,
} from "firebase/firestore";

const firebaseConfig = {
  apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID,
};

export const firebaseConfigured = Object.values(firebaseConfig).every(Boolean);

// Keystore/Keychain-backed persistence — session tokens must never sit in
// AsyncStorage (see DSS Wearable App security must-dos, Data Storage §2).
//
// Firebase's persistence keys look like `firebase:authUser:<apiKey>:[DEFAULT]`
// (see _persistenceKeyName in firebase/auth), but SecureStore only accepts
// alphanumeric characters plus ".", "-", "_" and throws on anything else.
// Left unsanitized, that throw happens inside Firebase's persistence init,
// before onAuthStateChanged ever fires — auth silently hangs forever with no
// crash. The mapping only needs to be consistent, not reversible.
const sanitizeKey = (key: string) => key.replace(/[^A-Za-z0-9._-]/g, "_");

const secureStorePersistence = {
  getItem: (key: string) => SecureStore.getItemAsync(sanitizeKey(key)),
  setItem: (key: string, value: string) =>
    SecureStore.setItemAsync(sanitizeKey(key), value),
  removeItem: (key: string) => SecureStore.deleteItemAsync(sanitizeKey(key)),
};

let auth: Auth | null = null;
let db: Firestore | null = null;

if (firebaseConfigured) {
  const app = getApps().length ? getApp() : initializeApp(firebaseConfig);

  try {
    auth = initializeAuth(app, {
      persistence: getReactNativePersistence(secureStorePersistence),
    });
  } catch {
    // initializeAuth throws if it (or getAuth) already ran on this app instance,
    // e.g. during Fast Refresh — fall back to the existing instance.
    auth = getAuth(app);
  }

  try {
    // React Native lacks full support for the streaming transport Firestore
    // prefers, which makes writes hang or error out. Long polling is the
    // supported transport here.
    db = initializeFirestore(app, { experimentalForceLongPolling: true });
  } catch {
    // Same re-entry case as above.
    db = getFirestore(app);
  }
} else {
  console.warn(
    "Firebase not initialized: missing EXPO_PUBLIC_FIREBASE_* env vars.",
  );
}

export { auth, db };
