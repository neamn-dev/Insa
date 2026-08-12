import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, signInWithPopup, signInWithRedirect, getRedirectResult } from 'firebase/auth';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || "AIzaSyD-XQnO5__IsE2LRSD6davBjdPHQD1Zbiw",
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || "identity-system-f84c1.firebaseapp.com",
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || "identity-system-f84c1",
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || "identity-system-f84c1.firebasestorage.app",
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "981744222364",
  appId: import.meta.env.VITE_FIREBASE_APP_ID || "1:981744222364:web:d84e68c43b4fabb2852d59"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();

// Force Google to present account chooser with all user emails
googleProvider.setCustomParameters({
  prompt: 'select_account'
});

/**
 * Check if the user is returning from a Firebase Google Redirect
 */
export const checkFirebaseRedirectResult = async () => {
  try {
    const result = await getRedirectResult(auth);
    if (result && result.user) {
      const idToken = await result.user.getIdToken();
      return {
        success: true,
        user: result.user,
        idToken
      };
    }
  } catch (error) {
    console.error("Firebase Redirect Result Error:", error);
    return {
      success: false,
      error: error.message
    };
  }
  return null;
};

export const signInWithGoogle = async () => {
  try {
    const result = await signInWithPopup(auth, googleProvider);
    const user = result.user;
    const idToken = await user.getIdToken();
    return {
      success: true,
      user,
      idToken
    };
  } catch (error) {
    console.warn("Firebase Google Popup Sign-In notice:", error);

    // If popup is blocked by browser, fallback to Firebase Redirect flow
    if (
      error.code === 'auth/popup-blocked' ||
      error.code === 'auth/popup-closed-by-user' ||
      error.message?.includes('popup-blocked')
    ) {
      try {
        await signInWithRedirect(auth, googleProvider);
        return {
          success: false,
          useRedirect: true
        };
      } catch (redirectErr) {
        return {
          success: false,
          error: redirectErr.message || "Firebase Google redirect sign-in failed."
        };
      }
    }

    return {
      success: false,
      error: error.message || "Google sign-in via Firebase failed."
    };
  }
};

