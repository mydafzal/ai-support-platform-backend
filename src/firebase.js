const { initializeApp } = require("firebase/app");
const { getStorage } = require("firebase/storage");

// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyB-BCh9KgeZWTLZtKReszqSXGmTmc_2HF0",
  authDomain: "redit-clone-75760.firebaseapp.com",
  projectId: "redit-clone-75760",
  storageBucket: "redit-clone-75760.appspot.com",
  messagingSenderId: "926865071298",
  appId: "1:926865071298:web:1e09211fe362fdf8206f5b",
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const storage = getStorage(app);

module.exports = { app, storage };
