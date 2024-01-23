const { initializeApp } = require("firebase/app");
const { getFirestore } = require("firebase/firestore");
const { getStorage } = require("firebase/storage");

var admin = require("firebase-admin");

var serviceAccount = require("../../firebase-admin-service-key.json");

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

const firebaseConfig = {
  apiKey: "AIzaSyDywXgVOE5dbwXs0AZrAmarYxqcycUN-uk",
  authDomain: "ai-ccript.firebaseapp.com",
  projectId: "ai-ccript",
  storageBucket: "ai-ccript.appspot.com",
  messagingSenderId: "654756323555",
  appId: "1:654756323555:web:02ef14176e5b7d2fa865d6",
  measurementId: "G-5XEGG9LW0V",
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const storage = getStorage(app);
// const firestore = getFirestore(app);

const firestore = admin.firestore();

module.exports = { app, storage, firestore };
