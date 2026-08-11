// simulado.js
// Gera simulados puxando questões proporcionalmente ao peso de cada domínio na prova,
// corrige ao final e gera automaticamente um plano de revisão dos assuntos errados.

import { collection, query, where, getDocs, limit } from "https://www.gstatic.com/firebasejs/12.15.0/firebase-firestore.js";
import { db } from "./firebase-config.js";
import { saveSimulado, logQuestionAttempt, getAllUserTopicProgress } from "./data-schema.js";

const DOMAIN_WEIGHTS = {
  "Network Fundamentals": 0.20,
  "Network Access": 0.20,
  "IP Connectivity": 0.25,
  "IP Services": 0.10,
  "Security Fundamentals": 0.15,
  "Automation and Programmability": 0.10,
};

/** Busca N*3 questões candidatas de um domínio (margem extra pra seleção adaptativa depois). */
async function fetchQuestionsByDomain(dominio, quantidade) {
  const q = query(
    collection(db, "content", "questions", "items"),
    where("dominio", "==", dominio),
    limit(quantidade * 3)
  );
  const snap = await getDocs(q);
  const todas = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  return todas.sort(() => Math.random() - 0.5);
}

// Estilo "PassIQ" do AlphaPrep: a dificuldade da questão escolhida acompanha
// o quanto você já domina aquele tópico específico — questão fácil pra reforçar
// o básico onde ainda está fraco, difícil pra testar de verdade onde já manda bem.
function dificuldadeAlvo(masteryPercent) {
  if (masteryPercent >= 70) return "dificil";
  if (masteryPercent >= 40) return "medio";
  return "facil";
}

function selecionarAdaptativo(candidatas, quantidade, masteryPorTopico) {
  const comPrioridade = candidatas.map((q) => {
    const mastery = masteryPorTopico.get(q.topicId) ?? 0;
    const alvo = dificuldadeAlvo(mastery);
    return { q, prioridade: q.dificuldade === alvo ? 1 : 0 };
  });
  // Questões que combinam com o nível atual do usuário vêm primeiro; o resto preenche o restante.
  comPrioridade.sort((a, b) => b.prioridade - a.prioridade);
  return comPrioridade.slice(0, quantidade).map((x) => x.q);
}

/**
 * Monta um simulado com `totalQuestoes` questões, respeitando a proporção
 * oficial de peso de cada domínio no exame CCNA 200-301, e ajustando a
 * dificuldade de cada questão ao seu nível atual de domínio no tópico.
 */
export async function gerarSimulado(uid, totalQuestoes = 40) {
  const progresso = uid ? await getAllUserTopicProgress(uid).catch(() => []) : [];
  const masteryPorTopico = new Map(progresso.map((p) => [p.id, p.masteryPercent ?? 0]));

  const questoesPorDominio = await Promise.all(
    Object.entries(DOMAIN_WEIGHTS).map(async ([dominio, peso]) => {
      const quantidade = Math.max(1, Math.round(totalQuestoes * peso));
      const candidatas = await fetchQuestionsByDomain(dominio, quantidade);
      return selecionarAdaptativo(candidatas, quantidade, masteryPorTopico);
    })
  );

  const todasQuestoes = questoesPorDominio.flat().sort(() => Math.random() - 0.5);

  return {
    questoes: todasQuestoes,
    totalQuestoes: todasQuestoes.length,
    iniciadoEm: new Date().toISOString(),
  };
}

/**
 * Corrige o simulado, salva o resultado e gera o plano de revisão automático
 * (lista de tópicos errados, prontos pra virar foco no próximo daily plan).
 */
export async function corrigirESalvarSimulado(uid, simulado, respostasUsuario) {
  // respostasUsuario: { [questaoId]: "A" | "B" | "C" | "D" }
  let acertos = 0;
  const questoesErradas = [];

  for (const questao of simulado.questoes) {
    const respostaDada = respostasUsuario[questao.id];
    const correta = respostaDada === questao.respostaCorreta;

    if (correta) {
      acertos += 1;
    } else {
      questoesErradas.push({
        questaoId: questao.id,
        topicId: questao.topicId,
        dominio: questao.dominio,
        respostaDada: respostaDada || null,
        respostaCorreta: questao.respostaCorreta,
        justificativa: questao.justificativa,
      });
    }

    await logQuestionAttempt(uid, {
      questionId: questao.id,
      topicId: questao.topicId,
      correct: correta,
    });
  }

  const percentual = Math.round((acertos / simulado.totalQuestoes) * 100);
  const duracaoMin = Math.round((Date.now() - new Date(simulado.iniciadoEm).getTime()) / 60000);

  // Plano automático de revisão: tópicos únicos errados, ordenados por frequência de erro.
  const contagemPorTopico = {};
  questoesErradas.forEach((q) => {
    contagemPorTopico[q.topicId] = (contagemPorTopico[q.topicId] || 0) + 1;
  });
  const planoRevisaoGerado = Object.entries(contagemPorTopico)
    .sort((a, b) => b[1] - a[1])
    .map(([topicId, vezes]) => ({ topicId, vezesErrado: vezes }));

  const resultado = {
    totalQuestoes: simulado.totalQuestoes,
    acertos,
    percentual,
    duracaoMin,
    questoesErradas,
    planoRevisaoGerado,
  };

  await saveSimulado(uid, resultado);
  return resultado;
}
