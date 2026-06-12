import { getApp, getApps, initializeApp, type FirebaseApp } from "firebase/app";
import {
  browserSessionPersistence,
  getAuth,
  getIdTokenResult,
  signInWithCustomToken,
  signOut,
  setPersistence,
  type Auth,
} from "firebase/auth";
import { getFirestore, type Firestore } from "firebase/firestore";

interface FirebaseClientConfig {
  apiKey: string;
  appId: string;
  authDomain: string;
  measurementId?: string;
  messagingSenderId: string;
  projectId: string;
  storageBucket: string;
}

let authPersistencePromise: Promise<void> | null = null;

function readFirebaseClientConfig(): FirebaseClientConfig {
  const config: FirebaseClientConfig = {
    apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
    appId: import.meta.env.VITE_FIREBASE_APP_ID,
    authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
    measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID,
    messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
    projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
    storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  };

  const missingKeys = Object.entries(config)
    .filter(([key, value]) => key !== "measurementId" && !value)
    .map(([key]) => key);

  if (missingKeys.length > 0) {
    throw new Error(
      `Missing Firebase client config: ${missingKeys.join(", ")}.`,
    );
  }

  return config;
}

function getFirebaseClientApp(): FirebaseApp {
  return getApps().length > 0
    ? getApp()
    : initializeApp(readFirebaseClientConfig());
}

export function getFirebaseClientAuth(): Auth {
  return getAuth(getFirebaseClientApp());
}

export function getFirebaseClientDb(): Firestore {
  return getFirestore(getFirebaseClientApp());
}

export async function ensureFirebaseClientSession(
  customToken: string,
  uid: string,
  expectedRole?: string,
): Promise<void> {
  const auth = getFirebaseClientAuth();

  authPersistencePromise ??= setPersistence(auth, browserSessionPersistence);
  await authPersistencePromise;

  const credential = await signInWithCustomToken(auth, customToken);

  if (credential.user.uid !== uid) {
    throw new Error("Live chat session does not match the signed-in account.");
  }

  const token = await getIdTokenResult(credential.user, true);

  if (expectedRole && token.claims.role !== expectedRole) {
    throw new Error("Live chat session permissions are not ready yet.");
  }
}

export async function clearFirebaseClientSession(): Promise<void> {
  const auth = getFirebaseClientAuth();

  if (!auth.currentUser) {
    return;
  }

  await signOut(auth);
}
