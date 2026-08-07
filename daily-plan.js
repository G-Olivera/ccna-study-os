// daily-plan.js
// Gera automaticamente o plano do dia: teoria + lab + revisão + flashcards + quiz + desafio.
// Princípio TDAH: o usuário nunca decide "o que estudar hoje" — o sistema decide.
// O plano é idempotente: se já existe um plano pra hoje, ele é reaproveitado
// (evita gerar um plano diferente toda vez que o app é reaberto no mesmo dia).

import {
  collection,
  query,
  where,
  limit,
  getDocs,
  doc,
  setDoc,
  getDoc,
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

import { db } from "./firebase-config.js";
import { getAllTopics, getAllUserTopicProgress, getDailyPlan, saveDailyPlan } from "./data-schema.js";
import { getDueCards, createNewCardData } from "./srs-engine.js";

// Ordem dos domínios seguindo o roadmap de 20 semanas já definido.
const DOMAIN_ORDER = [
  "Network Fundamentals",
  "Network Access",
  "IP Connectivity",
  "IP Services",
  "Security Fundamentals",
  "Automation and Programmability",
];

const DEFAULT_MINUTES = 45;
const MASTERY_WEAK_THRESHOLD = 50;

function todayKey() {
  return new Date().toISOString().slice(0, 10); // YYYY-MM-DD
}

// Compara IDs de lição tipo "m07-03" vs "m12-01" numericamente (módulo, depois lição).
function compareTopicIds(a, b) {
  const parse = (t) => {
    const m = t.id.match(/^m(\d+)-(\d+)$/);
    return m ? [Number(m[1]), Number(m[2])] : [0, 0];
  };
  const [aMod, aLes] = parse(a);
  const [bMod, bLes] = parse(b);
  return aMod - bMod || aLes - bLes;
}

/**
 * Escolhe o tópico foco do dia:
 * 1. Se existe algo com domínio fraco (mastery < 50%) já iniciado -> reforça isso primeiro.
 * 2. Senão, avança pro próximo tópico novo na sequência do blueprint.
 * 3. Se tudo já foi visto e está forte -> modo revisão geral (pega o mais fraco no geral).
 */
function chooseFocusTopic(allTopics, userProgress) {
  const progressMap = new Map(userProgress.map((p) => [p.id, p]));

  const weakStarted = allTopics
    .filter((t) => progressMap.has(t.id) && (progressMap.get(t.id).masteryPercent ?? 0) < MASTERY_WEAK_THRESHOLD)
    .sort((a, b) => (progressMap.get(a.id).masteryPercent ?? 0) - (progressMap.get(b.id).masteryPercent ?? 0));

  if (weakStarted.length > 0) {
    return { topic: weakStarted[0], motivo: "reforco" };
  }

  const unstarted = allTopics
    .filter((t) => !progressMap.has(t.id))
    .sort(compareTopicIds)
    .sort((a, b) => DOMAIN_ORDER.indexOf(a.dominio) - DOMAIN_ORDER.indexOf(b.dominio));

  if (unstarted.length > 0) {
    return { topic: unstarted[0], motivo: "novo_conteudo" };
  }

  const geral = [...allTopics].sort(
    (a, b) => (progressMap.get(a.id)?.masteryPercent ?? 100) - (progressMap.get(b.id)?.masteryPercent ?? 100)
  );
  return { topic: geral[0], motivo: "revisao_geral" };
}

// Busca até N questões do banco de questões pro tópico foco (Fase 6 popula content/questions).
async function fetchQuizQuestions(topicId, n = 5) {
  try {
    const q = query(collection(db, "content", "questions", "items"), where("topicId", "==", topicId), limit(n));
    const snap = await getDocs(q);
    return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  } catch {
    return []; // banco ainda não populado — plano funciona normalmente sem quiz
  }
}

// Busca o laboratório associado ao tópico foco (Fase 10 popula content/labs).
async function fetchLab(topicId) {
  try {
    const q = query(collection(db, "content", "labs", "items"), where("topicId", "==", topicId), limit(1));
    const snap = await getDocs(q);
    return snap.docs[0] ? { id: snap.docs[0].id, ...snap.docs[0].data() } : null;
  } catch {
    return null;
  }
}

// Busca flashcards de referência do tópico foco pra virar novos SRS cards do dia.
async function fetchFlashcardTemplates(topicId, n = 5) {
  try {
    const q = query(collection(db, "content", "flashcards", "items"), where("topicId", "==", topicId), limit(n));
    const snap = await getDocs(q);
    return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  } catch {
    return [];
  }
}

/**
 * Gera (ou recupera, se já existir) o plano de hoje para o usuário.
 */
export async function generateDailyPlan(uid, opções = {}) {
  const dateKey = todayKey();

  const existing = await getDailyPlan(uid, dateKey);
  if (existing) return existing;

  const minutosDisponiveis = opções.minutosDisponiveis || DEFAULT_MINUTES;

  const [allTopics, userProgress, srsQueue] = await Promise.all([
    getAllTopics(),
    getAllUserTopicProgress(uid),
    getDueCards(uid),
  ]);

  const { topic: focusTopic, motivo } = chooseFocusTopic(allTopics, userProgress);

  const [quizQuestions, lab, flashcardTemplates] = await Promise.all([
    fetchQuizQuestions(focusTopic.id),
    fetchLab(focusTopic.id),
    fetchFlashcardTemplates(focusTopic.id),
  ]);

  // Cria os novos cards SRS do dia a partir dos templates do tópico foco
  // (só os que ainda não existem pro usuário — evita duplicar).
  const novosCardsCriados = [];
  for (const tmpl of flashcardTemplates) {
    const cardRef = doc(db, "users", uid, "srsCards", tmpl.id);
    const already = await getDoc(cardRef);
    if (!already.exists()) {
      const novoCard = createNewCardData(focusTopic.id, tmpl.front, tmpl.back);
      await setDoc(cardRef, novoCard);
      novosCardsCriados.push(tmpl.id);
    }
  }

  const plano = {
    date: dateKey,
    focusTopic: { id: focusTopic.id, nome: focusTopic.nome, dominio: focusTopic.dominio, motivo },
    minutosDisponiveis,
    teoria: {
      topicId: focusTopic.id,
      // Prompt pronto pra Fase 5 (IA Tutor) explicar esse tópico sob demanda.
      promptSugerido: `Explique "${focusTopic.nome}" (domínio ${focusTopic.dominio}) para quem está estudando CCNA 200-301.`,
      concluido: false,
    },
    lab: lab
      ? { labId: lab.id, titulo: lab.titulo || focusTopic.nome, concluido: false }
      : { labId: null, titulo: null, concluido: false, pendente: "conteúdo de labs ainda não populado (Fase 10)" },
    revisao: {
      cardsDevidos: srsQueue.revisoes.map((c) => c.id),
      totalDevido: srsQueue.revisoes.length,
      concluido: false,
    },
    flashcards: {
      novosCriadosHoje: novosCardsCriados,
      concluido: false,
    },
    quiz: {
      topicId: focusTopic.id,
      questoes: quizQuestions.map((q) => q.id),
      concluido: false,
      pendente: quizQuestions.length === 0 ? "banco de questões ainda não populado (Fase 6)" : undefined,
    },
    desafio: {
      topicId: focusTopic.id,
      descricao: `Desafio prático: configure/explique um cenário envolvendo "${focusTopic.nome}" sem consultar anotações.`,
      concluido: false,
    },
  };

  await saveDailyPlan(uid, dateKey, plano);
  return plano;
}

/**
 * Marca uma seção do plano de hoje como concluída (teoria, lab, revisao, flashcards, quiz, desafio).
 */
export async function markPlanSectionComplete(uid, secao) {
  const dateKey = todayKey();
  const plano = await getDailyPlan(uid, dateKey);
  if (!plano || !plano[secao]) return null;

  plano[secao].concluido = true;
  await saveDailyPlan(uid, dateKey, plano);
  return plano;
}
