// simulado.js
// Gera simulados puxando questões proporcionalmente ao peso de cada domínio na prova,
// corrige ao final e gera automaticamente um plano de revisão dos assuntos errados.

import { collection, query, where, getDocs, limit } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { db } from "./firebase-config.js";
import { saveSimulado, logQuestionAttempt } from "./data-schema.js";

const DOMAIN_WEIGHTS = {
  "Network Fundamentals": 0.20,
  "Network Access": 0.20,
  "IP Connectivity": 0.25,
  "IP Services": 0.10,
  "Security Fundamentals": 0.15,
  "Automation and Programmability": 0.10,
};

/** Busca N questões aleatórias de um domínio (via campo `randomKey` sorteado no seed). */
async function fetchQuestionsByDomain(dominio, quantidade) {
  const q = query(
    collection(db, "content", "questions", "items"),
    where("dominio", "==", dominio),
    limit(quantidade * 3) // busca uma margem maior pra poder embaralhar client-side
  );
  const snap = await getDocs(q);
  const todas = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  return todas.sort(() => Math.random() - 0.5).slice(0, quantidade);
}

/**
 * Monta um simulado com `totalQuestoes` questões, respeitando a proporção
 * oficial de peso de cada domínio no exame CCNA 200-301.
 */
export async function gerarSimulado(totalQuestoes = 40) {
  const questoesPorDominio = await Promise.all(
    Object.entries(DOMAIN_WEIGHTS).map(async ([dominio, peso]) => {
      const quantidade = Math.max(1, Math.round(totalQuestoes * peso));
      const questoes = await fetchQuestionsByDomain(dominio, quantidade);
      return questoes;
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
