// preferences.js
// Sincroniza as preferências do app entre aparelhos, via Firestore
// (users/{uid}/config/preferencias). O localStorage continua sendo a fonte
// para o primeiro paint (evita flash de tema errado); depois do login o valor
// remoto reconcilia. Só entram aqui coisas que fazem sentido seguir o usuário
// de um dispositivo pro outro — não estado local de layout (sidebar colapsada,
// cache de capas etc.).

import { doc, getDoc, setDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/12.15.0/firebase-firestore.js";
import { db } from "./firebase-config.js";

const CHAVES = [
  "ccna-study-os-theme",
  "ccna-study-os-theme-sistema",
  "ccna-study-os-accent",
  "ccna-study-os-densidade",
  "ccna-study-os-lembrete-horario",
  "ccna-study-os-lembrete-ativo",
  "ccna-study-os-ocultar-valores",
  "ccna_mapa_capitulos_v1",
];

function ref(uid) {
  return doc(db, "users", uid, "config", "preferencias");
}

export function coletarPreferenciasLocais() {
  const p = {};
  for (const k of CHAVES) {
    const v = localStorage.getItem(k);
    if (v !== null) p[k] = v;
  }
  return p;
}

/** Grava no localStorage os valores vindos do Firestore. Retorna true se algo mudou. */
export function aplicarPreferenciasNoLocalStorage(prefs) {
  if (!prefs) return false;
  let mudou = false;
  for (const k of CHAVES) {
    if (typeof prefs[k] === "string" && localStorage.getItem(k) !== prefs[k]) {
      localStorage.setItem(k, prefs[k]);
      mudou = true;
    }
  }
  return mudou;
}

export async function baixarPreferencias(uid) {
  const snap = await getDoc(ref(uid));
  return snap.exists() ? snap.data() : null;
}

export async function salvarPreferencias(uid) {
  await setDoc(
    ref(uid),
    { ...coletarPreferenciasLocais(), atualizadoEm: serverTimestamp() },
    { merge: true }
  );
}
