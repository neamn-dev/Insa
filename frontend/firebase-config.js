/**
 * Firebase Auth Integration Module - Frontend
 * Supports Firebase Web SDK v10 with Google Auth Provider (Redirect Mode, NO popup) & Email/Password.
 * Sends Firebase ID Token to Flask backend (/api/firebase-login) to sync with SQLite database.
 */

// Firebase Configuration (Replace values with your Firebase Console project settings)
const firebaseConfig = window.FIREBASE_CONFIG || {
  apiKey: "YOUR_FIREBASE_API_KEY",
  authDomain: "YOUR_PROJECT_ID.firebaseapp.com",
  projectId: "YOUR_PROJECT_ID",
  storageBucket: "YOUR_PROJECT_ID.appspot.com",
  messagingSenderId: "YOUR_MESSAGING_SENDER_ID",
  appId: "YOUR_APP_ID"
};

// Check if user configured real credentials
function isFirebaseConfigured() {
  return firebaseConfig.apiKey && firebaseConfig.apiKey !== "YOUR_FIREBASE_API_KEY";
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
      signInWithRedirect, 
      getRedirectResult, 
      signInWithEmailAndPassword, 
      createUserWithEmailAndPassword, 
      signOut 
    } = await import('https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js');

    if (isFirebaseConfigured()) {
      firebaseApp = initializeApp(firebaseConfig);
      firebaseAuth = getAuth(firebaseApp);
      googleProvider = new GoogleAuthProvider();
    }

    window.FirebaseSDK = {
      initializeApp,
      getAuth,
      GoogleAuthProvider,
      signInWithRedirect,
      getRedirectResult,
      signInWithEmailAndPassword,
      createUserWithEmailAndPassword,
      signOut
    };
    window.firebaseModulesLoaded = true;

    // Check if returning from Google Redirect
    if (isFirebaseConfigured()) {
      checkGoogleRedirectResult();
    }

    return true;
  } catch (err) {
    console.warn("Firebase SDK initialization warning:", err);
    return false;
  }
}

/**
 * Handle Google Sign-In via REDIRECT (No Popup)
 */
async function loginWithFirebaseGoogle() {
  await initFirebase();

  if (!isFirebaseConfigured()) {
    console.log("Firebase credentials not configured. Using backend demo Google sign-in redirect fallback.");
    return false; // Fallback to backend demo mode
  }

  try {
    const { signInWithRedirect } = window.FirebaseSDK;
    // Trigger full browser redirect to Google login (NO POPUP)
    await signInWithRedirect(firebaseAuth, googleProvider);
    return { success: true, redirecting: true };
  } catch (err) {
    console.error("Firebase Google Redirect Error:", err);
    return { success: false, message: err.message || "Google Redirect failed." };
  }
}

/**
 * Process Google Sign-In result after redirect back to application
 */
async function checkGoogleRedirectResult() {
  try {
    const { getRedirectResult } = window.FirebaseSDK;
    const result = await getRedirectResult(firebaseAuth);

    if (result && result.user) {
      const user = result.user;
      const idToken = await user.getIdToken();

      // Authenticate with Flask backend SQLite database
      const res = await fetch('/api/firebase-login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          id_token: idToken,
          email: user.email,
          name: user.displayName || user.email.split('@')[0],
          uid: user.uid
        })
      });

      const data = await res.json();
      if (res.ok) {
        sessionStorage.setItem('access_token', data.access_token);
        if (data.suspicious_login) {
          sessionStorage.setItem('suspicious_login', 'true');
          sessionStorage.setItem('previous_device', data.previous_device || 'Unknown');
        }
        window.location.href = 'dashboard.html';
      }
    }
  } catch (err) {
    console.error("Error processing Google redirect result:", err);
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
    const res = await fetch('/api/firebase-login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({
        id_token: idToken,
        email: user.email,
        name: name || user.email.split('@')[0],
        uid: user.uid
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
