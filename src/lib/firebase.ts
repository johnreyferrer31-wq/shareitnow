import { initializeApp } from 'firebase/app';
import { 
  getAuth, 
  GoogleAuthProvider, 
  signInWithPopup, 
  signOut,
  signInWithRedirect,
  getRedirectResult 
} from 'firebase/auth';
import { initializeFirestore } from 'firebase/firestore';
import { firebaseConfig } from './firebase-config';

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);

// Use standard initialization for production
export const db = initializeFirestore(app, {}, firebaseConfig.firestoreDatabaseId);

export const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: 'select_account' });

export const signInWithGoogle = () => signInWithPopup(auth, googleProvider);
export const signInWithGoogleRedirect = () => signInWithRedirect(auth, googleProvider);
export const checkRedirectResult = () => getRedirectResult(auth);
export const logOut = () => signOut(auth);
