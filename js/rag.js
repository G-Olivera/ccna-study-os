// rag.js
// RAG (Retrieval-Augmented Generation) simples sobre o conteúdo do PRÓPRIO app —
// nunca sobre material de terceiros. Busca por palavra-chave (sem embeddings,
// mantém a arquitetura 100% gratuita) nos tópicos e flashcards que já existem
// no Firestore, e monta um contexto pra IA responder com mais precisão e
// sugerir lições relacionadas da sua própria Trilha.

import { collection, getDocs, query, where, limit } from "https://www.gstatic.com/firebasejs/12.15.0/firebase-firestore.js";
import { db } from "./firebase-config.js";
import { getAllTopics } from "./data-schema.js";

function normalizar(texto) {
  return texto
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, ""); // remove acentos pra comparação mais tolerante
}

function pontuarRelevancia(texto, termos) {
  const textoNorm = normalizar(texto);
  return termos.reduce((acc, termo) => (textoNorm.includes(termo) ? acc + 1 : acc), 0);
}

/** Acha as lições da sua própria Trilha mais relevantes pra uma consulta. */
export async function buscarLicoesRelacionadas(consulta, maxResultados = 4) {
  const termos = normalizar(consulta)
    .split(/\s+/)
    .filter((t) => t.length > 2); // ignora palavras muito curtas (de, um, o...)

  if (termos.length === 0) return [];

  const todasLicoes = await getAllTopics();
  const pontuadas = todasLicoes
    .map((l) => ({ licao: l, pontos: pontuarRelevancia(`${l.nome} ${l.modulo}`, termos) }))
    .filter((x) => x.pontos > 0)
    .sort((a, b) => b.pontos - a.pontos);

  return pontuadas.slice(0, maxResultados).map((x) => x.licao);
}

/** Busca flashcards do próprio banco ligados a uma lista de tópicos. */
async function buscarFlashcardsPorTopicos(topicIds) {
  const resultados = [];
  for (const topicId of topicIds.slice(0, 3)) {
    try {
      const q = query(collection(db, "content", "flashcards", "items"), where("topicId", "==", topicId), limit(2));
      const snap = await getDocs(q);
      snap.docs.forEach((d) => resultados.push(d.data()));
    } catch {
      // se falhar (ex: sem permissão momentânea), só segue sem esse item
    }
  }
  return resultados;
}

/**
 * Monta um bloco de contexto (RAG) com o que o PRÓPRIO app já sabe sobre o
 * assunto perguntado — lições relacionadas + flashcards existentes — pra dar
 * mais grounding à resposta da IA e evitar contradizer o que já está na Trilha.
 */
export async function montarContextoRAG(consulta) {
  try {
    const licoesRelacionadas = await buscarLicoesRelacionadas(consulta);
    if (licoesRelacionadas.length === 0) return "";

    const topicIds = licoesRelacionadas.map((l) => l.id);
    const flashcards = await buscarFlashcardsPorTopicos(topicIds);

    let contexto = "Contexto do app de estudos do usuário (lições da própria Trilha relacionadas a essa pergunta):\n";
    licoesRelacionadas.forEach((l) => {
      contexto += `- Lição "${l.nome}" (módulo: ${l.modulo}, domínio do blueprint: ${l.dominio})\n`;
    });

    if (flashcards.length > 0) {
      contexto += "\nFlashcards que já existem no app sobre temas próximos (pra manter consistência, sem repetir do zero):\n";
      flashcards.forEach((fc) => {
        contexto += `- P: ${fc.front} / R: ${fc.back}\n`;
      });
    }

    return contexto;
  } catch {
    return ""; // RAG é um extra — se falhar, a explicação continua funcionando sem ele
  }
}
