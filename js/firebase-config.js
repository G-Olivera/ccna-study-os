// firebase-config.js
// Substitua os valores abaixo pelos do SEU projeto Firebase
// (Console > Configurações do projeto > Seus apps > SDK setup and configuration).

import { initializeApp } from "https://www.gstatic.com/firebasejs/12.15.0/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/12.15.0/firebase-auth.js";
import {
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
} from "https://www.gstatic.com/firebasejs/12.15.0/firebase-firestore.js";
import { getAI, GoogleAIBackend } from "https://www.gstatic.com/firebasejs/12.15.0/firebase-ai.js";
import { initializeAppCheck, ReCaptchaV3Provider } from "https://www.gstatic.com/firebasejs/12.15.0/firebase-app-check.js";

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

// Firestore com cache local persistente (IndexedDB): o app abre com os últimos
// dados conhecidos e continua funcionando offline — leituras vêm do cache e as
// escritas ficam numa fila que sincroniza sozinha quando a conexão volta.
// persistentMultipleTabManager: mantém o cache consistente com várias abas abertas.
export const db = initializeFirestore(app, {
  localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }),
});

// App Check: protege Firestore/Auth/AI Logic contra chamadas automatizadas (bots, scripts)
// que não venham do seu app de verdade. Funciona no plano gratuito Spark.
// Troque "SUA_CHAVE_RECAPTCHA_V3_AQUI" pela site key gerada em
// Firebase Console > App Check > Registrar app > reCAPTCHA v3.
const CHAVE_RECAPTCHA_V3 = "SUA_CHAVE_RECAPTCHA_V3_AQUI";

export let appCheck = null;
if (CHAVE_RECAPTCHA_V3 !== "SUA_CHAVE_RECAPTCHA_V3_AQUI") {
  appCheck = initializeAppCheck(app, {
    provider: new ReCaptchaV3Provider(CHAVE_RECAPTCHA_V3),
    isTokenAutoRefreshEnabled: true,
  });
} else {
  console.info("[App Check] Ainda não configurado — troque CHAVE_RECAPTCHA_V3 em firebase-config.js quando quiser ativar essa camada extra de segurança.");
}

// Firebase AI Logic, backend "Gemini Developer API" — funciona no plano Spark (gratuito),
// sem precisar de Cloud Functions nem cartão de crédito. Precisa estar ativado em
// Firebase Console > Serviços de IA > AI Logic antes de funcionar.
export const ai = getAI(app, { backend: new GoogleAIBackend() });
