import { applicationDefault, initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { getAuth } from "firebase-admin/auth";
const projectId =
  process.env.GOOGLE_CLOUD_PROJECT || "project-b00660ba-d6d4-4c9a-a05";
initializeApp({ projectId, credential: applicationDefault() });
export const database = getFirestore();
export const auth = getAuth();
export const userRef = (uid: string) => database.collection("users").doc(uid);
