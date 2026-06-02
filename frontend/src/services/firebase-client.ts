import { getApp, getApps, initializeApp, type FirebaseApp } from "firebase/app";
import {
  getAuth,
  signInWithCustomToken,
  signOut,
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
): Promise<void> {
  const auth = getFirebaseClientAuth();

  if (auth.currentUser?.uid === uid) {
    return;
  }

  await signInWithCustomToken(auth, customToken);
}

export async function clearFirebaseClientSession(): Promise<void> {
  const auth = getFirebaseClientAuth();

  if (!auth.currentUser) {
    return;
  }

  await signOut(auth);
}
