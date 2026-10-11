import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import {
  getFirestore, collection, doc, getDocs, getDoc,
  setDoc, updateDoc, deleteDoc, onSnapshot, addDoc,
  serverTimestamp, query, orderBy
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import { firebaseConfig } from "./config.js";

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);

export {
  collection, doc, getDocs, getDoc,
  setDoc, updateDoc, deleteDoc, onSnapshot, addDoc,
  serverTimestamp, query, orderBy
};
