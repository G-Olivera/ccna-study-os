// quick-review.js
// Gera uma sessão de estudo encaixada no tempo real disponível agora.
// Estimativas de tempo por item, calibradas pra sessões curtas e sem sobrecarga.

import { getDueCards } from "./srs-engine.js";
import { getAllUserTopicProgress } from "./data-schema.js";

const TEMPO_POR_FLASHCARD_SEG = 25;
const TEMPO_POR_QUESTAO_SEG = 75;

export const DURACOES_DISPONIVEIS = [5, 10, 15, 30]; // minutos

/**
 * Monta uma sessão de revisão rápida cabendo em `minutosDisponiveis`.
 * Prioriza: 1) cards SRS mais atrasados, 2) tópicos mais fracos.
 * Sempre flashcards primeiro (mais rápido, gera momentum), questões depois se sobrar tempo.
 */
export async function gerarRevisaoRapida(uid, minutosDisponiveis) {
  const segundosDisponiveis = minutosDisponiveis * 60;

  const [{ revisoes }, progresso] = await Promise.all([getDueCards(uid), getAllUserTopicProgress(uid)]);

  // Quantos flashcards cabem no tempo, deixando ~30% do tempo pra questões se houver sessão maior.
  const orcamentoFlashcardsSeg = minutosDisponiveis <= 10 ? segundosDisponiveis : segundosDisponiveis * 0.6;
  const maxFlashcards = Math.floor(orcamentoFlashcardsSeg / TEMPO_POR_FLASHCARD_SEG);

  const flashcardsSelecionados = revisoes.slice(0, maxFlashcards);
  const tempoUsadoFlashcards = flashcardsSelecionados.length * TEMPO_POR_FLASHCARD_SEG;

  const tempoRestanteSeg = segundosDisponiveis - tempoUsadoFlashcards;
  const maxQuestoes = Math.max(0, Math.floor(tempoRestanteSeg / TEMPO_POR_QUESTAO_SEG));

  // Foco em questões: pega os tópicos mais fracos do progresso do usuário.
  const topicosFracos = [...progresso]
    .sort((a, b) => (a.masteryPercent ?? 0) - (b.masteryPercent ?? 0))
    .slice(0, Math.max(1, maxQuestoes))
    .map((p) => p.id);

  return {
    duracaoAlvo: minutosDisponiveis,
    flashcards: flashcardsSelecionados,
    totalFlashcards: flashcardsSelecionados.length,
    focoQuestoes: {
      topicIds: topicosFracos,
      quantidadeSugerida: maxQuestoes,
    },
    tempoEstimadoSeg: tempoUsadoFlashcards + maxQuestoes * TEMPO_POR_QUESTAO_SEG,
  };
}

/** Atalho pra UI: botões prontos de 5/10/15/30 min. */
export function opcoesDeDuracao() {
  return DURACOES_DISPONIVEIS.map((min) => ({
    minutos: min,
    label: min < 60 ? `${min} min` : `${min / 60}h`,
  }));
}
