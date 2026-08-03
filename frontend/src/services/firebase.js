import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, signInWithPopup } from 'firebase/auth';

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

// Force Google to present account chooser with all user emails without forcing password re-entry if logged in
googleProvider.setCustomParameters({
  prompt: 'select_account'
});


/**
 * Trigger Google Sign-In via Popup and return the Firebase ID token
 */
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
    console.error("Firebase Google Popup Login Error:", error);
    if (error.code === 'auth/unauthorized-domain' || error.message?.includes('unauthorized-domain')) {
      return {
        success: false,
        unauthorizedDomain: true,
        error: "Firebase unauthorized domain. Switching to OAuth redirect..."
      };
    }
    return {
      success: false,
      error: error.message || "Google sign-in popup was closed or failed."
    };
  }
};

