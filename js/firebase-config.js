// firebase-config.js
// Substitua os valores abaixo pelos do SEU projeto Firebase
// (Console > Configurações do projeto > Seus apps > SDK setup and configuration).

import { initializeApp } from "https://www.gstatic.com/firebasejs/12.15.0/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/12.15.0/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/12.15.0/firebase-firestore.js";
import { getAI, GoogleAIBackend } from "https://www.gstatic.com/firebasejs/12.15.0/firebase-ai.js";

const firebaseConfig = {
  apiKey: "AIzaSyDCfSuD0tDJeT_9yiKe9cwzZI9dNZBNQaI",
  authDomain: "ccna-study-os.firebaseapp.com",
  projectId: "ccna-study-os",
  storageBucket: "ccna-study-os.firebasestorage.app",
  messagingSenderId: "1037183110558",
  appId: "1:1037183110558:web:5faf49a37fd52c99af9a8f",
};

export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);

// Firebase AI Logic, backend "Gemini Developer API" — funciona no plano Spark (gratuito),
// sem precisar de Cloud Functions nem cartão de crédito. Precisa estar ativado em
// Firebase Console > Serviços de IA > AI Logic antes de funcionar.
export const ai = getAI(app, { backend: new GoogleAIBackend() });
