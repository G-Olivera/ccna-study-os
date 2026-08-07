// ai-tutor.js
// Wrapper client-side para a Cloud Function aiTutor.
// Requer Firebase Functions SDK inicializado em firebase-config.js (export `functions`).

import { httpsCallable } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-functions.js";
import { functions } from "./firebase-config.js";

const callAiTutor = httpsCallable(functions, "aiTutor");

export const MODOS_EXPLICACAO = {
  INICIANTE: "iniciante",
  TECNICO: "tecnico",
  ANALOGIA: "analogia",
  PROVA: "prova",
};

/** Pede explicação de um tópico do blueprint em um dos 4 estilos. */
export async function explicarTopico(nomeTopico, modo = MODOS_EXPLICACAO.INICIANTE) {
  const { data } = await callAiTutor({ topico: nomeTopico, modo });
  return data.resposta;
}

/** Pergunta livre pro tutor (ex: "por que meu ping não funciona nessa topologia?"). */
export async function perguntarLivre(pergunta) {
  const { data } = await callAiTutor({ perguntaLivre: pergunta });
  return data.resposta;
}
