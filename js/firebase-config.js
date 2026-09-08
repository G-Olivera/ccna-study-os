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
// que não venham do seu app de verdade.
//
// DESLIGADO por enquanto, de propósito: o reCAPTCHA v3 "clássico" foi descontinuado
// pelo Google e já não funciona (erro 400 confirmado tentando usar, em 08/09/2026).
// O substituto, reCAPTCHA Enterprise, tem cota gratuita de 10.000 avaliações/mês, mas
// exige cadastrar um cartão de crédito no Google Cloud (mesmo sem cobrança dentro da
// cota) — decisão consciente de não fazer isso agora. O app funciona 100% sem essa
// camada extra; ela só adicionava proteção contra bots chamando a API diretamente
// (sem passar pelo seu app de verdade). A segurança principal (regras do Firestore,
// Auth, MFA) continua ativa normalmente.
//
// Pra ativar quando quiser: gere uma chave em Google Cloud Console > Segurança >
// reCAPTCHA Enterprise > Criar chave (tipo "Site", domínio g-olivera.github.io) e troque
// este bloco por:
//
// import { initializeAppCheck, ReCaptchaEnterpriseProvider } from "https://www.gstatic.com/firebasejs/12.15.0/firebase-app-check.js";
// const CHAVE_RECAPTCHA_ENTERPRISE = "SUA_CHAVE_AQUI";
// export const appCheck = initializeAppCheck(app, {
//   provider: new ReCaptchaEnterpriseProvider(CHAVE_RECAPTCHA_ENTERPRISE),
//   isTokenAutoRefreshEnabled: true,
// });
export const appCheck = null;

// Firebase AI Logic, backend "Gemini Developer API" — funciona no plano Spark (gratuito),
// sem precisar de Cloud Functions nem cartão de crédito. Precisa estar ativado em
// Firebase Console > Serviços de IA > AI Logic antes de funcionar.
export const ai = getAI(app, { backend: new GoogleAIBackend() });
