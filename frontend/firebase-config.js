/**
 * Firebase Auth Integration Module - Frontend
 * Supports Firebase Web SDK v10 with Google Auth Provider Popup & Email/Password.
 * Sends Firebase ID Token to Flask backend (/api/auth/firebase) to sync session with PostgreSQL.
 */

// Firebase Configuration (Replace values with your Firebase Console project settings)
const firebaseConfig = window.FIREBASE_CONFIG || {
  apiKey: "AIzaSyD-XQnO5__IsE2LRSD6davBjdPHQD1Zbiw",
  authDomain: "identity-system-f84c1.firebaseapp.com",
  projectId: "identity-system-f84c1",
  storageBucket: "identity-system-f84c1.firebasestorage.app",
  messagingSenderId: "981744222364",
  appId: "1:981744222364:web:d84e68c43b4fabb2852d59"
};

// Check if user configured credentials
function isFirebaseConfigured() {
  return firebaseConfig.apiKey && firebaseConfig.apiKey !== "AIzaSyD-XQnO5__IsE2LRSD6davBjdPHQD1Zbiw;
}

let firebaseApp = null;
let firebaseAuth = null;
let googleProvider = null;

// Initialize Firebase SDK
async function initFirebase() {
  if (window.firebaseModulesLoaded) return true;

  try {
    const { initializeApp } = await import('https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js');
    const {
      getAuth,
      GoogleAuthProvider,
      signInWithPopup,
      signInWithEmailAndPassword,
      createUserWithEmailAndPassword,
      signOut
    } = await import('https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js');

    if (isFirebaseConfigured()) {
      firebaseApp = initializeApp(firebaseConfig);
      firebaseAuth = getAuth(firebaseApp);
      googleProvider = new GoogleAuthProvider();
      // Force Google to present account chooser with all user emails without forcing password re-entry if logged in
      googleProvider.setCustomParameters({
        prompt: 'select_account'
      });
    }

    window.FirebaseSDK = {
      initializeApp,
      getAuth,
      GoogleAuthProvider,
      signInWithPopup,
      signInWithEmailAndPassword,
      createUserWithEmailAndPassword,
      signOut
    };
    window.firebaseModulesLoaded = true;
    return true;
  } catch (err) {
    console.warn("Firebase SDK initialization warning:", err);
    return false;
  }
}

/**
 * Trigger Google Sign-In via Popup (with account selection, no password prompt if already logged in)
 */
async function loginWithFirebaseGoogle() {
  await initFirebase();

  if (!isFirebaseConfigured()) {
    console.log("Firebase credentials not configured. Using backend demo Google sign-in fallback.");
    return false;
  }

  try {
    const { signInWithPopup } = window.FirebaseSDK;
    const result = await signInWithPopup(firebaseAuth, googleProvider);
    const user = result.user;
    const idToken = await user.getIdToken();

    // Authenticate with Flask backend
    const res = await fetch('/api/auth/firebase', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({
        token: idToken
      })
    });

    const data = await res.json();
    if (res.ok) {
      sessionStorage.setItem('access_token', data.access_token);
      if (data.suspicious_login) {
        sessionStorage.setItem('suspicious_login', 'true');
        sessionStorage.setItem('previous_device', data.previous_device || 'Unknown');
      }
      return { success: true, data };
    } else {
      return { success: false, message: data.message || "Backend authentication failed." };
    }
  } catch (err) {
    console.error("Firebase Google Popup Login Error:", err);
    return { success: false, message: err.message || "Google sign-in popup failed or closed." };
  }
}

/**
 * Handle Firebase Email/Password Registration
 */
async function registerWithFirebaseEmail(email, password, name) {
  await initFirebase();
  if (!isFirebaseConfigured()) return null;

  try {
    const { createUserWithEmailAndPassword } = window.FirebaseSDK;
    const userCredential = await createUserWithEmailAndPassword(firebaseAuth, email, password);
    const user = userCredential.user;
    const idToken = await user.getIdToken();

    // Sync with Flask backend
    const res = await fetch('/api/auth/firebase', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({
        token: idToken
      })
    });

    const data = await res.json();
    return { success: res.ok, data };
  } catch (err) {
    return { success: false, message: err.message };
  }
}

// Auto-initialize on load
initFirebase();
