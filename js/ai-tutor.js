// ai-tutor.js
// Tutor IA usando Firebase AI Logic com o backend "Gemini Developer API".
// Roda 100% no plano Spark (gratuito) — o Firebase protege a chave por trás das câmeras,
// sem precisar de Cloud Functions, sem cartão de crédito.
//
// Pré-requisito: ativar em Firebase Console > Serviços de IA > AI Logic > Começar
// (escolher "Gemini Developer API" quando perguntado).

import { getGenerativeModel } from "https://www.gstatic.com/firebasejs/12.15.0/firebase-ai.js";
import { ai } from "./firebase-config.js";

const SYSTEM_INSTRUCTION =
  "Você é um instrutor Cisco CCNA 200-301 explicando para um estudante com TDAH. " +
  "Seja direto, use frases curtas, divida em passos pequenos, e evite parágrafos longos. " +
  "Responda em texto puro, sem formatação Markdown (sem asteriscos, sem #, sem listas com traço).";

const model = getGenerativeModel(ai, {
  model: "gemini-3.6-flash",
  systemInstruction: SYSTEM_INSTRUCTION,
});

export const MODOS_EXPLICACAO = {
  INICIANTE: "iniciante",
  TECNICO: "tecnico",
  ANALOGIA: "analogia",
  PROVA: "prova",
};

const INSTRUCAO_POR_MODO = {
  iniciante: "Explique como se eu fosse totalmente iniciante em redes, sem jargão técnico, usando passo a passo simples.",
  tecnico: "Explique de forma técnica e precisa, como faria um instrutor Cisco experiente, incluindo termos corretos.",
  analogia: "Explique usando uma analogia do dia a dia que torne o conceito fácil de lembrar.",
  prova: "Explique focando exatamente em como a Cisco cobra esse assunto na prova CCNA 200-301, incluindo pegadinhas comuns.",
};

/** Pede explicação de um tópico do blueprint em um dos 4 estilos. */
export async function explicarTopico(nomeTopico, modo = MODOS_EXPLICACAO.INICIANTE) {
  const instrucao = INSTRUCAO_POR_MODO[modo] || INSTRUCAO_POR_MODO.iniciante;
  const prompt = `${instrucao}\n\nAssunto: ${nomeTopico} (blueprint CCNA 200-301).`;
  const result = await model.generateContent(prompt);
  return result.response.text();
}

/** Pergunta livre pro tutor (ex: "por que meu ping não funciona nessa topologia?"). */
export async function perguntarLivre(pergunta) {
  const result = await model.generateContent(pergunta);
  return result.response.text();
}
