// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyDxt_moahMw3QG3lWLITi3XGtYLc9L75og",
  authDomain: "fir-ef4d4.firebaseapp.com",
  databaseURL: "https://fir-ef4d4-default-rtdb.firebaseio.com",
  projectId: "fir-ef4d4",
  storageBucket: "fir-ef4d4.appspot.com",
  messagingSenderId: "250323634329",
  appId: "1:250323634329:web:2367b4d582c1e5ddea9008",
  measurementId: "G-96CGLCZ7NK"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
// const analytics = getAnalytics(app);

// Get Firestore instance
export const db = getFirestore(app);

// You can export other services like Auth, Storage if needed later
// export const auth = getAuth(app);
// export const storage = getStorage(app);