// dashboard.js
// Agrega dados de todas as coleções pra alimentar o dashboard:
// progresso geral, progresso por domínio, horas estudadas, streak,
// nível/XP, assuntos dominados, assuntos críticos, previsão de prontidão.

import { collection, getDocs, query, orderBy } from "https://www.gstatic.com/firebasejs/12.15.0/firebase-firestore.js";
import { db } from "./firebase-config.js";
import { getAllTopics, getAllUserTopicProgress } from "./data-schema.js";

// Peso oficial de cada domínio no exame CCNA 200-301 (blueprint da Cisco).
const DOMAIN_WEIGHTS = {
  "Network Fundamentals": 20,
  "Network Access": 20,
  "IP Connectivity": 25,
  "IP Services": 10,
  "Security Fundamentals": 15,
  "Automation and Programmability": 10,
};

const MASTERED_THRESHOLD = 80;
const CRITICAL_THRESHOLD = 40;

// ---------- HELPERS DE BUSCA ----------

async function fetchActivityLog(uid) {
  const q = query(collection(db, "users", uid, "activityLog"), orderBy("timestamp", "desc"));
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

async function fetchQuestionAttempts(uid) {
  const snap = await getDocs(collection(db, "users", uid, "questionAttempts"));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

// ---------- PROGRESSO GERAL E POR DOMÍNIO ----------

function computeDomainProgress(allTopics, userProgress) {
  const progressMap = new Map(userProgress.map((p) => [p.id, p]));
  const domains = {};

  allTopics.forEach((topic) => {
    if (!domains[topic.dominio]) {
      domains[topic.dominio] = { totalTopicos: 0, somaMastery: 0 };
    }
    domains[topic.dominio].totalTopicos += 1;
    domains[topic.dominio].somaMastery += progressMap.get(topic.id)?.masteryPercent ?? 0;
  });

  return Object.entries(domains).map(([dominio, dados]) => ({
    dominio,
    pesoExame: DOMAIN_WEIGHTS[dominio] ?? 0,
    progressoPercent: Math.round(dados.somaMastery / dados.totalTopicos),
  }));
}

function computeOverallProgress(allTopics, userProgress) {
  const progressMap = new Map(userProgress.map((p) => [p.id, p]));
  if (allTopics.length === 0) return 0;
  const soma = allTopics.reduce((acc, t) => acc + (progressMap.get(t.id)?.masteryPercent ?? 0), 0);
  return Math.round(soma / allTopics.length);
}

// Prontidão ponderada pelo peso de cada domínio no exame —
// mais realista que uma média simples, já que os domínios não valem o mesmo.
function computeExamReadiness(domainProgress) {
  const somaPesos = domainProgress.reduce((acc, d) => acc + d.pesoExame, 0);
  if (somaPesos === 0) return 0;
  const somaPonderada = domainProgress.reduce((acc, d) => acc + d.progressoPercent * d.pesoExame, 0);
  return Math.round(somaPonderada / somaPesos);
}

// ---------- ASSUNTOS DOMINADOS / CRÍTICOS ----------

function getMasteredAndCriticalTopics(allTopics, userProgress) {
  const progressMap = new Map(userProgress.map((p) => [p.id, p]));

  const dominados = allTopics.filter((t) => (progressMap.get(t.id)?.masteryPercent ?? 0) >= MASTERED_THRESHOLD);

  const criticos = allTopics.filter((t) => {
    const p = progressMap.get(t.id);
    // "crítico" = já foi tocado (tem progresso) mas está fraco — não inclui tópicos nunca vistos
    return p && (p.masteryPercent ?? 0) < CRITICAL_THRESHOLD;
  });

  return { dominados, criticos };
}

// ---------- STREAK (SEQUÊNCIA DE DIAS ESTUDANDO) ----------

function computeStreak(activityLog) {
  if (activityLog.length === 0) return 0;

  const diasComAtividade = new Set(
    activityLog.map((a) => a.timestamp?.toDate?.().toISOString().slice(0, 10)).filter(Boolean)
  );

  let streak = 0;
  const cursor = new Date();

  // Se ainda não estudou hoje, começa a contagem checando a partir de ontem
  // (não zera o streak só porque ainda é cedo no dia de hoje).
  if (!diasComAtividade.has(cursor.toISOString().slice(0, 10))) {
    cursor.setDate(cursor.getDate() - 1);
  }

  while (diasComAtividade.has(cursor.toISOString().slice(0, 10))) {
    streak += 1;
    cursor.setDate(cursor.getDate() - 1);
  }

  return streak;
}

// ---------- HORAS ESTUDADAS ----------

function computeStudyHours(activityLog) {
  const totalMinutos = activityLog.reduce((acc, a) => acc + (a.duracao || 0), 0);
  return Math.round((totalMinutos / 60) * 10) / 10; // 1 casa decimal
}

// ---------- XP E NÍVEL ----------

function computeXpAndLevel(questionAttempts, activityLog, streak) {
  const acertos = questionAttempts.filter((q) => q.correct).length;
  const minutosEstudados = activityLog.reduce((acc, a) => acc + (a.duracao || 0), 0);

  const xp = acertos * 10 + minutosEstudados * 1 + streak * 15;
  const level = Math.floor(xp / 500) + 1;
  const xpParaProximoNivel = level * 500 - xp;

  return { xp, level, xpParaProximoNivel };
}

// ---------- FUNÇÃO PRINCIPAL ----------

/**
 * Monta o objeto completo consumido pela tela de Dashboard.
 */
// ---------- CALENDÁRIO DE STREAK (estilo GitHub) ----------

/**
 * Retorna os últimos `dias` dias com o total de minutos estudados em cada um,
 * pronto pra virar um mapa de calor tipo "gráfico de contribuições".
 */
export async function getHistoricoStreak(uid, dias = 84) {
  const inicio = new Date();
  inicio.setDate(inicio.getDate() - (dias - 1));
  inicio.setHours(0, 0, 0, 0);

  const activityLog = await fetchActivityLog(uid);

  const porDia = {};
  activityLog.forEach((a) => {
    const data = a.timestamp?.toDate?.();
    if (!data || data < inicio) return;
    const chave = data.toISOString().slice(0, 10);
    porDia[chave] = (porDia[chave] || 0) + (a.duracao || 0);
  });

  const resultado = [];
  const cursor = new Date(inicio);
  for (let i = 0; i < dias; i++) {
    const chave = cursor.toISOString().slice(0, 10);
    resultado.push({ data: chave, minutos: Math.round(porDia[chave] || 0) });
    cursor.setDate(cursor.getDate() + 1);
  }
  return resultado;
}

export async function getDashboardData(uid) {
  const [allTopics, userProgress, activityLog, questionAttempts] = await Promise.all([
    getAllTopics(),
    getAllUserTopicProgress(uid),
    fetchActivityLog(uid),
    fetchQuestionAttempts(uid),
  ]);

  const domainProgress = computeDomainProgress(allTopics, userProgress);
  const overallProgress = computeOverallProgress(allTopics, userProgress);
  const examReadiness = computeExamReadiness(domainProgress);
  const { dominados, criticos } = getMasteredAndCriticalTopics(allTopics, userProgress);
  const streak = computeStreak(activityLog);
  const studyHours = computeStudyHours(activityLog);
  const { xp, level, xpParaProximoNivel } = computeXpAndLevel(questionAttempts, activityLog, streak);

  return {
    progressoGeral: overallProgress,
    prontidaoExame: examReadiness,
    progressoPorDominio: domainProgress,
    horasEstudadas: studyHours,
    streakDias: streak,
    nivel: level,
    xp,
    xpParaProximoNivel,
    assuntosDominados: dominados.map((t) => ({ id: t.id, nome: t.nome, dominio: t.dominio })),
    assuntosCriticos: criticos.map((t) => ({ id: t.id, nome: t.nome, dominio: t.dominio })),
    totalTopicos: allTopics.length,
    totalQuestoesRespondidas: questionAttempts.length,
    totalAcertos: questionAttempts.filter((q) => q.correct).length,
  };
}
