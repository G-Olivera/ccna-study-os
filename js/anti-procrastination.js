// anti-procrastination.js
// Detecta quantos dias o usuário ficou sem estudar e ajusta a carga do dia
// automaticamente — sem empilhar atraso, sem mensagem de culpa.

import { collection, query, orderBy, limit, getDocs } from "https://www.gstatic.com/firebasejs/12.15.0/firebase-firestore.js";
import { db } from "./firebase-config.js";

// Mensagens de retorno — sempre neutras/acolhedoras, nunca de cobrança.
const MENSAGENS_RETORNO = {
  curto: "Bom te ver de novo! Vamos com calma hoje.",
  medio: "Faz um tempinho — tudo bem, vamos retomar num ritmo leve.",
  longo: "Pausas acontecem. Hoje é só sobre voltar a começar, sem pressão.",
};

async function getUltimaAtividade(uid) {
  const q = query(collection(db, "users", uid, "activityLog"), orderBy("timestamp", "desc"), limit(1));
  const snap = await getDocs(q);
  if (snap.empty) return null;
  return snap.docs[0].data().timestamp?.toDate?.() || null;
}

function diasDesde(data) {
  if (!data) return null;
  const diffMs = Date.now() - data.getTime();
  return Math.floor(diffMs / (1000 * 60 * 60 * 24));
}

/**
 * Verifica há quanto tempo o usuário não estuda e retorna:
 * - o nível de ausência
 * - a mensagem de retorno apropriada (sem culpa)
 * - o multiplicador de carga a aplicar no plano diário (reduz volume, não aumenta)
 */
export async function verificarAusencia(uid) {
  const ultimaAtividade = await getUltimaAtividade(uid);
  const dias = diasDesde(ultimaAtividade);

  if (dias === null || dias <= 1) {
    return { ausente: false, dias: dias ?? 0, mensagem: null, multiplicadorCarga: 1 };
  }

  if (dias <= 3) {
    return { ausente: true, dias, mensagem: MENSAGENS_RETORNO.curto, multiplicadorCarga: 0.85 };
  }

  if (dias <= 7) {
    return { ausente: true, dias, mensagem: MENSAGENS_RETORNO.medio, multiplicadorCarga: 0.6 };
  }

  // Mais de uma semana: sessão bem leve, só pra recriar o hábito.
  return { ausente: true, dias, mensagem: MENSAGENS_RETORNO.longo, multiplicadorCarga: 0.35 };
}

/**
 * Aplica o multiplicador de carga a um plano diário já gerado
 * (reduz quantidade de revisão/quiz, nunca aumenta ou "cobra atraso").
 */
export function ajustarPlanoParaRetorno(plano, multiplicadorCarga) {
  if (multiplicadorCarga >= 1) return plano;

  const planoAjustado = { ...plano };

  if (planoAjustado.revisao?.cardsDevidos) {
    const novoTotal = Math.max(3, Math.round(planoAjustado.revisao.cardsDevidos.length * multiplicadorCarga));
    planoAjustado.revisao = {
      ...planoAjustado.revisao,
      cardsDevidos: planoAjustado.revisao.cardsDevidos.slice(0, novoTotal),
    };
  }

  if (planoAjustado.quiz?.questoes) {
    const novoTotal = Math.max(1, Math.round(planoAjustado.quiz.questoes.length * multiplicadorCarga));
    planoAjustado.quiz = { ...planoAjustado.quiz, questoes: planoAjustado.quiz.questoes.slice(0, novoTotal) };
  }

  // Em ausências longas, o desafio prático e o lab ficam opcionais (não aparecem como obrigatórios).
  if (multiplicadorCarga <= 0.6) {
    planoAjustado.lab = { ...planoAjustado.lab, opcional: true };
    planoAjustado.desafio = { ...planoAjustado.desafio, opcional: true };
  }

  return planoAjustado;
}
