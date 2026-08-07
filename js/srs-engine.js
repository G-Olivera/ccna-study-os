// srs-engine.js
// Motor de repetição espaçada baseado no SM-2 (algoritmo do Anki), adaptado:
// - Intervalos iniciais mais curtos (memória de trabalho com TDAH esquece mais rápido)
// - Cards atrasados sobem de prioridade automaticamente
// - Nunca deixa o "efeito bola de neve": limita quantos cards novos entram por dia

import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  query,
  where,
  orderBy,
  limit,
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

import { db } from "./firebase-config.js";
import { upsertUserTopicProgress } from "./data-schema.js";

// ---------- CONFIGURAÇÃO ----------

const DEFAULT_EASE = 2.5;
const MIN_EASE = 1.3;

// Intervalos iniciais em dias (mais curtos que o SM-2 padrão de 1/6)
const INITIAL_INTERVALS = [1, 3, 7];

// Quantos cards NOVOS (nunca revisados) entram no plano por dia.
// Evita sobrecarga — TDAH lida mal com "300 cards pra revisar hoje".
export const MAX_NEW_CARDS_PER_DAY = 8;

// Quantos cards de revisão (já vistos) entram no máximo por dia.
export const MAX_REVIEW_CARDS_PER_DAY = 25;

// Mapa de qualidade da resposta -> usado no cálculo do ease factor.
// 0 = Errei totalmente | 1 = Difícil, mas acertei | 2 = Bom | 3 = Fácil
export const QUALITY = {
  AGAIN: 0,
  HARD: 1,
  GOOD: 2,
  EASY: 3,
};

// ---------- CRIAÇÃO DE CARD ----------

export function createNewCardData(topicId, front, back) {
  return {
    topicId,
    front,
    back,
    easeFactor: DEFAULT_EASE,
    interval: 0,
    repetitions: 0,
    lapses: 0,
    dueDate: new Date().toISOString(), // novo card: disponível imediatamente
  };
}

// ---------- CÁLCULO SM-2 ADAPTADO ----------

/**
 * Recebe o estado atual do card + a qualidade da resposta (0-3)
 * e retorna o novo estado (não grava no banco — isso é feito por reviewAndSave).
 */
export function calculateNextReview(card, quality) {
  let { easeFactor, interval, repetitions, lapses } = card;

  if (quality === QUALITY.AGAIN) {
    // Errou: reseta repetições, card volta pra fila logo (não pro fim da fila de dias)
    repetitions = 0;
    lapses += 1;
    interval = 0; // reaparece no mesmo dia / próxima sessão
    easeFactor = Math.max(MIN_EASE, easeFactor - 0.2);
  } else {
    if (repetitions < INITIAL_INTERVALS.length) {
      interval = INITIAL_INTERVALS[repetitions];
    } else {
      interval = Math.round(interval * easeFactor);
    }
    repetitions += 1;

    // Ajuste do ease factor conforme dificuldade percebida
    if (quality === QUALITY.HARD) {
      easeFactor = Math.max(MIN_EASE, easeFactor - 0.15);
    } else if (quality === QUALITY.EASY) {
      easeFactor = easeFactor + 0.15;
    }
    // GOOD mantém o ease factor como está
  }

  const dueDate = new Date();
  dueDate.setDate(dueDate.getDate() + interval);

  return {
    easeFactor: Number(easeFactor.toFixed(2)),
    interval,
    repetitions,
    lapses,
    dueDate: dueDate.toISOString(),
  };
}

// ---------- LEITURA: CARDS DEVIDOS HOJE ----------

/**
 * Retorna os cards que devem ser revisados hoje, priorizando os mais atrasados.
 * Aplica os limites MAX_NEW_CARDS_PER_DAY / MAX_REVIEW_CARDS_PER_DAY.
 */
export async function getDueCards(uid) {
  const now = new Date().toISOString();
  const cardsRef = collection(db, "users", uid, "srsCards");

  const q = query(cardsRef, where("dueDate", "<=", now), orderBy("dueDate", "asc"));
  const snap = await getDocs(q);
  const allDue = snap.docs.map((d) => ({ id: d.id, ...d.data() }));

  const novos = allDue.filter((c) => c.repetitions === 0).slice(0, MAX_NEW_CARDS_PER_DAY);
  const revisoes = allDue.filter((c) => c.repetitions > 0).slice(0, MAX_REVIEW_CARDS_PER_DAY);

  return { novos, revisoes, totalDisponivel: allDue.length };
}

// ---------- ESCRITA: RESPONDER UM CARD ----------

/**
 * Aplica a resposta do usuário a um card: recalcula o agendamento,
 * salva no Firestore e atualiza o percentual de domínio (mastery) do tópico.
 */
export async function reviewAndSave(uid, cardId, quality) {
  const cardRef = doc(db, "users", uid, "srsCards", cardId);
  const snap = await getDoc(cardRef);
  if (!snap.exists()) throw new Error(`Card ${cardId} não encontrado`);

  const card = snap.data();
  const updated = calculateNextReview(card, quality);

  await setDoc(cardRef, updated, { merge: true });

  // Atualiza mastery do tópico associado (sobe em acerto, cai em erro)
  await updateTopicMastery(uid, card.topicId, quality);

  return updated;
}

async function updateTopicMastery(uid, topicId, quality) {
  const progressRef = doc(db, "users", uid, "topics", topicId);
  const snap = await getDoc(progressRef);
  const current = snap.exists() ? snap.data() : { masteryPercent: 0, timesCorrect: 0, timesWrong: 0 };

  let mastery = current.masteryPercent || 0;
  let timesCorrect = current.timesCorrect || 0;
  let timesWrong = current.timesWrong || 0;

  if (quality === QUALITY.AGAIN) {
    mastery = Math.max(0, mastery - 10);
    timesWrong += 1;
  } else {
    const ganho = quality === QUALITY.EASY ? 8 : quality === QUALITY.GOOD ? 5 : 3;
    mastery = Math.min(100, mastery + ganho);
    timesCorrect += 1;
  }

  await upsertUserTopicProgress(uid, topicId, {
    masteryPercent: mastery,
    timesCorrect,
    timesWrong,
    lastReviewed: new Date().toISOString(),
  });
}
