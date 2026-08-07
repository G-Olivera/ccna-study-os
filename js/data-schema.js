// data-schema.js
// Camada de acesso às coleções do Firestore descritas na Fase 1 da arquitetura.
// Assume Firebase SDK modular (v9+). Se seu projeto usa a versão "compat",
// veja a nota no final do arquivo para adaptar a sintaxe.
//
// Pré-requisito: firebase-config.js já deve ter inicializado `app` e exportado `db`.

import {
  collection,
  doc,
  setDoc,
  getDoc,
  getDocs,
  updateDoc,
  addDoc,
  query,
  where,
  orderBy,
  serverTimestamp,
} from "https://www.gstatic.com/firebasejs/12.15.0/firebase-firestore.js";

import { db } from "./firebase-config.js";

// ---------- CONTEÚDO GLOBAL (somente leitura) ----------

export async function getAllTopics() {
  const snap = await getDocs(collection(db, "content/topics/items"));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

export async function getTopicsByDomain(dominio) {
  const q = query(collection(db, "content/topics/items"), where("dominio", "==", dominio));
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

// ---------- PROGRESSO DO USUÁRIO ----------

function userSub(uid, sub) {
  return collection(db, "users", uid, sub);
}

/** Cria/atualiza o registro de progresso do usuário para um tópico específico. */
export async function upsertUserTopicProgress(uid, topicId, data) {
  const ref = doc(db, "users", uid, "topics", topicId);
  await setDoc(ref, { ...data, lastUpdated: serverTimestamp() }, { merge: true });
}

export async function getUserTopicProgress(uid, topicId) {
  const ref = doc(db, "users", uid, "topics", topicId);
  const snap = await getDoc(ref);
  return snap.exists() ? { id: snap.id, ...snap.data() } : null;
}

export async function getAllUserTopicProgress(uid) {
  const snap = await getDocs(userSub(uid, "topics"));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

/** Registra uma tentativa de questão (usado pelo dashboard e pelo motor SRS). */
export async function logQuestionAttempt(uid, attempt) {
  return addDoc(userSub(uid, "questionAttempts"), {
    ...attempt,
    timestamp: serverTimestamp(),
  });
}

/** Salva o resultado de um simulado completo. */
export async function saveSimulado(uid, simulado) {
  return addDoc(userSub(uid, "simulados"), {
    ...simulado,
    data: serverTimestamp(),
  });
}

export async function getSimulados(uid) {
  const q = query(userSub(uid, "simulados"), orderBy("data", "desc"));
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

/** Salva/atualiza o progresso de um laboratório prático. */
export async function upsertLabProgress(uid, labId, data) {
  const ref = doc(db, "users", uid, "labProgress", labId);
  await setDoc(ref, data, { merge: true });
}

/** Salva o plano diário gerado (usado pela Fase 3). */
export async function saveDailyPlan(uid, dateKey, plan) {
  const ref = doc(db, "users", uid, "dailyPlans", dateKey);
  await setDoc(ref, plan, { merge: true });
}

export async function getDailyPlan(uid, dateKey) {
  const ref = doc(db, "users", uid, "dailyPlans", dateKey);
  const snap = await getDoc(ref);
  return snap.exists() ? snap.data() : null;
}

/** Salva/atualiza o perfil do usuário (data da prova, horas/semana disponíveis, etc). */
export async function saveUserProfile(uid, profileData) {
  const ref = doc(db, "users", uid);
  await setDoc(ref, { profile: profileData }, { merge: true });
}

export async function getUserProfile(uid) {
  const ref = doc(db, "users", uid);
  const snap = await getDoc(ref);
  return snap.exists() ? snap.data().profile || null : null;
}

/** Log genérico de atividade — alimenta streak, XP e o dashboard. */
export async function logActivity(uid, tipo, topicId, duracaoMin) {
  return addDoc(userSub(uid, "activityLog"), {
    tipo,
    topicId: topicId || null,
    duracao: duracaoMin || 0,
    timestamp: serverTimestamp(),
  });
}

/*
NOTA — Se seu projeto usa o SDK "compat" (firebase.firestore()) em vez do modular:
Troque os imports por:
  const db = firebase.firestore();
E troque as chamadas por:
  db.collection("users").doc(uid).collection("topics").doc(topicId).set(data, { merge: true })
A lógica e os nomes de coleção continuam os mesmos.
*/
