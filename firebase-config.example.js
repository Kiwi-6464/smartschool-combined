/**
 * Smartschool Combined - Firebase project settings (online league), EXAMPLE.
 *
 * Copy this file to firebase-config.js and fill in your own Firebase project
 * (Realtime Database + Anonymous sign-in). firebase-config.js is git-ignored.
 * Also put your databaseURL in the host_permissions of manifest.json and your
 * Smartschool user id in database.rules.json. Every value below is a dummy.
 */
const firebaseConfig = {
  apiKey: "YOUR_FIREBASE_API_KEY",
  authDomain: "your-project.firebaseapp.com",
  projectId: "your-project",
  storageBucket: "your-project.firebasestorage.app",
  messagingSenderId: "000000000000",
  appId: "1:000000000000:web:0000000000000000000000",
  measurementId: "G-XXXXXXXXXX",
  // The online league lives in the Realtime Database (REST: <path>.json).
  databaseURL: "https://your-project-default-rtdb.europe-west1.firebasedatabase.app"
};

// Loaded by the service worker (importScripts in background.js), where the
// global object is `self`, not `window`.
(typeof window !== "undefined" ? window : self).sscFirebaseConfig = firebaseConfig;

// Smartschool user id(s) that may add and remove TI-84 programs. The database
// rules name the same id; change both together. Empty = nobody is host.
(typeof window !== "undefined" ? window : self).sscCalcHostIds = [];
