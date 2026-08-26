import {
  GoogleSignin,
  isErrorWithCode,
  statusCodes,
} from "@react-native-google-signin/google-signin";
import {
  GoogleAuthProvider,
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  sendPasswordResetEmail,
  signInAnonymously,
  signInWithCredential,
  signInWithEmailAndPassword,
  signOut,
  type User,
} from "firebase/auth";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { AppState, View } from "react-native";

import type { Messages } from "@/i18n";
import { auth, firebaseConfigured } from "./firebaseConfig";

/**
 * Google's native sign-in, configured once at module load.
 *
 * The browser-based flow this replaced (expo-auth-session) is refused by
 * Google for native apps — "doesn't comply with Google's OAuth 2.0 policy" —
 * because it hands credentials through a web view rather than the platform's
 * own account picker.
 *
 * webClientId is what makes Google return an idToken, which is the thing
 * Firebase needs; the Android client is matched by package name and signing
 * certificate rather than being passed here.
 */
const googleWebClientId = process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID;
const googleIosClientId = process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID;

export const googleSignInConfigured = Boolean(googleWebClientId);

if (googleSignInConfigured) {
  GoogleSignin.configure({
    webClientId: googleWebClientId,
    iosClientId: googleIosClientId,
  });
}

/** Error keys that map onto translated strings in `Messages`. */
export type AuthErrorKey = Extract<
  keyof Messages,
  | "errInvalidCredentials"
  | "errEmailInUse"
  | "errWeakPassword"
  | "errInvalidEmail"
  | "errTooManyRequests"
  | "errNetwork"
  | "errGeneric"
  | "errEmptyFields"
  | "errGoogleUnavailable"
>;

export class AuthError extends Error {
  readonly key: AuthErrorKey;
  constructor(key: AuthErrorKey) {
    super(key);
    this.name = "AuthError";
    this.key = key;
  }
}

/**
 * Firebase surfaces granular codes; we deliberately collapse the
 * wrong-password / user-not-found pair into one message so the app does not
 * leak which emails are registered.
 */
function toAuthError(error: unknown): AuthError {
  const code =
    typeof error === "object" && error && "code" in error
      ? String(error.code)
      : "";
  switch (code) {
    case "auth/invalid-credential":
    case "auth/wrong-password":
    case "auth/user-not-found":
    case "auth/invalid-login-credentials":
      return new AuthError("errInvalidCredentials");
    case "auth/email-already-in-use":
      return new AuthError("errEmailInUse");
    case "auth/weak-password":
      return new AuthError("errWeakPassword");
    case "auth/invalid-email":
      return new AuthError("errInvalidEmail");
    case "auth/too-many-requests":
      return new AuthError("errTooManyRequests");
    case "auth/network-request-failed":
      return new AuthError("errNetwork");
    default:
      return new AuthError("errGeneric");
  }
}

/** Auto sign-out after this much inactivity (security requirement: 15–30 min). */
const IDLE_LIMIT_MS = 20 * 60 * 1000;
const IDLE_CHECK_INTERVAL_MS = 30 * 1000;

type AuthValue = {
  user: User | null;
  loading: boolean;
  configured: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signInAnonymously: () => Promise<void>;
  register: (email: string, password: string) => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
  logOut: () => Promise<void>;
  /** Runs the whole native Google flow. Resolves false if the user backed out. */
  signInWithGoogle: () => Promise<boolean>;
  markActivity: () => void;
};

const AuthContext = createContext<AuthValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(firebaseConfigured);
  const lastActivity = useRef(Date.now());

  useEffect(() => {
    if (!auth) return;
    return onAuthStateChanged(auth, (nextUser) => {
      setUser(nextUser);
      lastActivity.current = Date.now();
      setLoading(false);
    });
  }, []);

  const markActivity = useCallback(() => {
    lastActivity.current = Date.now();
  }, []);

  // Idle expiry. Checked on a timer while foregrounded and again on resume,
  // so time spent backgrounded still counts toward the limit.
  useEffect(() => {
    if (!auth || !user) return;

    const expireIfIdle = () => {
      if (Date.now() - lastActivity.current < IDLE_LIMIT_MS) return;
      if (auth) void signOut(auth).catch(() => undefined);
    };

    const timer = setInterval(expireIfIdle, IDLE_CHECK_INTERVAL_MS);
    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "active") expireIfIdle();
    });

    return () => {
      clearInterval(timer);
      subscription.remove();
    };
  }, [user]);

  const value = useMemo<AuthValue>(
    () => ({
      user,
      loading,
      configured: firebaseConfigured,
      markActivity,
      signIn: async (email, password) => {
        if (!auth) throw new AuthError("errGeneric");
        if (!email.trim() || !password) throw new AuthError("errEmptyFields");
        try {
          await signInWithEmailAndPassword(auth, email.trim(), password);
          lastActivity.current = Date.now();
        } catch (error) {
          throw toAuthError(error);
        }
      },
      signInAnonymously: async () => {
        if (!auth) throw new AuthError("errGeneric");
        try {
          await signInAnonymously(auth);
          lastActivity.current = Date.now();
        } catch (error) {
          throw toAuthError(error);
        }
      },
      register: async (email, password) => {
        if (!auth) throw new AuthError("errGeneric");
        if (!email.trim() || !password) throw new AuthError("errEmptyFields");
        try {
          await createUserWithEmailAndPassword(auth, email.trim(), password);
          lastActivity.current = Date.now();
        } catch (error) {
          throw toAuthError(error);
        }
      },
      resetPassword: async (email) => {
        if (!auth) throw new AuthError("errGeneric");
        if (!email.trim()) throw new AuthError("errEmptyFields");
        try {
          await sendPasswordResetEmail(auth, email.trim());
        } catch (error) {
          throw toAuthError(error);
        }
      },
      logOut: async () => {
        // Sign out of Google too, otherwise its picker silently reuses the
        // previous account and "sign out" appears not to have worked.
        if (googleSignInConfigured) {
          await GoogleSignin.signOut().catch(() => undefined);
        }
        if (auth) await signOut(auth).catch(() => undefined);
      },
      signInWithGoogle: async () => {
        if (!auth || !googleSignInConfigured) throw new AuthError("errGeneric");
        try {
          // Android only; resolves immediately elsewhere.
          await GoogleSignin.hasPlayServices({
            showPlayServicesUpdateDialog: true,
          });

          const response = await GoogleSignin.signIn();
          // Backing out of the account picker is a choice, not a failure, so it
          // returns rather than throwing and does not raise an error banner.
          if (response.type !== "success") return false;

          const idToken = response.data?.idToken;
          if (!idToken) throw new AuthError("errGeneric");

          await signInWithCredential(
            auth,
            GoogleAuthProvider.credential(idToken),
          );
          lastActivity.current = Date.now();
          return true;
        } catch (error) {
          if (isErrorWithCode(error)) {
            switch (error.code) {
              case statusCodes.SIGN_IN_CANCELLED:
                return false;
              case statusCodes.IN_PROGRESS:
                // A second tap while the picker is already open.
                return false;
              case statusCodes.PLAY_SERVICES_NOT_AVAILABLE:
                throw new AuthError("errGoogleUnavailable");
            }
          }
          if (error instanceof AuthError) throw error;
          throw toAuthError(error);
        }
      },
    }),
    [user, loading, markActivity],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) throw new Error("useAuth must be used inside AuthProvider");
  return value;
}

/**
 * Resets the idle timer on any touch. Uses the capture-phase responder hook so
 * it observes every gesture without ever claiming one.
 */
export function ActivityTracker({ children }: { children: ReactNode }) {
  const { markActivity } = useAuth();
  return (
    <View
      style={{ flex: 1 }}
      onStartShouldSetResponderCapture={() => {
        markActivity();
        return false;
      }}
    >
      {children}
    </View>
  );
}
