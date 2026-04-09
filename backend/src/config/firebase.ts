import { App, cert, getApp, getApps, initializeApp } from "firebase-admin/app";
import { Auth, getAuth } from "firebase-admin/auth";
import { Firestore, getFirestore } from "firebase-admin/firestore";
import { getStorage } from "firebase-admin/storage";

import { env } from "./env";

type StorageBucket = ReturnType<ReturnType<typeof getStorage>["bucket"]>;

let firestoreInstance: Firestore | null = null;
let authInstance: Auth | null = null;

function createFirebaseApp(): App {
  if (getApps().length > 0) {
    return getApp();
  }

  if (!env.FIREBASE_PROJECT_ID || !env.FIREBASE_CLIENT_EMAIL || !env.FIREBASE_PRIVATE_KEY) {
    throw new Error(
      "Firebase Admin credentials are missing. Update backend/.env with FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, and FIREBASE_PRIVATE_KEY.",
    );
  }

  return initializeApp({
    credential: cert({
      projectId: env.FIREBASE_PROJECT_ID,
      clientEmail: env.FIREBASE_CLIENT_EMAIL,
      privateKey: env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, "\n"),
    }),
    storageBucket: env.FIREBASE_STORAGE_BUCKET,
  });
}

export function getDb(): Firestore {
  if (firestoreInstance) {
    return firestoreInstance;
  }

  firestoreInstance = getFirestore(createFirebaseApp());
  firestoreInstance.settings({ ignoreUndefinedProperties: true });

  return firestoreInstance;
}

export function getAdminAuth(): Auth {
  if (authInstance) {
    return authInstance;
  }

  authInstance = getAuth(createFirebaseApp());
  return authInstance;
}

export function getStorageBucket(bucketName?: string): StorageBucket {
  const resolvedBucketName = bucketName?.trim() || env.FIREBASE_STORAGE_BUCKET;

  if (!resolvedBucketName) {
    throw new Error(
      "Firebase Storage bucket is missing. Update backend/.env with FIREBASE_STORAGE_BUCKET before uploading product images.",
    );
  }

  return getStorage(createFirebaseApp()).bucket(resolvedBucketName);
}
