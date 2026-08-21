import {
    signInAnonymously,
    signInWithEmailAndPassword,
} from "firebase/auth";
import { auth } from "./firebaseConfig";

export async function loginWithEmailAndPassword(email: string, password: string) {
    return signInWithEmailAndPassword(auth, email, password);
}

export async function loginAnonymously() {
    return signInAnonymously(auth);
}

export async function logOutUser() {
    return auth.signOut();
}