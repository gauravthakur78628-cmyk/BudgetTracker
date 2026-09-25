// Replace these values with your own Firebase project's config.
// Firebase console → Project settings → General → "Your apps" → SDK setup and config.
// These values are safe to be public in client-side code — access is controlled by
// Firebase Authentication + Firestore security rules, not by hiding this file.
const firebaseConfig = {
  apiKey: "YOUR_API_KEY",
  authDomain: "YOUR_PROJECT_ID.firebaseapp.com",
  projectId: "YOUR_PROJECT_ID",
  storageBucket: "YOUR_PROJECT_ID.appspot.com",
  messagingSenderId: "YOUR_SENDER_ID",
  appId: "YOUR_APP_ID"
};

firebase.initializeApp(firebaseConfig);
