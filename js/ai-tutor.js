// ai-tutor.js
// Tutor IA usando Firebase AI Logic com o backend "Gemini Developer API".
// Roda 100% no plano Spark (gratuito) — o Firebase protege a chave por trás das câmeras,
// sem precisar de Cloud Functions, sem cartão de crédito.
//
// Pré-requisito: ativar em Firebase Console > Serviços de IA > AI Logic > Começar
// (escolher "Gemini Developer API" quando perguntado).

import { getGenerativeModel } from "https://www.gstatic.com/firebasejs/12.15.0/firebase-ai.js";
import { ai } from "./firebase-config.js";
import { montarContextoRAG } from "./rag.js";

const SYSTEM_INSTRUCTION =
  "Você é um instrutor Cisco CCNA 200-301 explicando para um estudante com TDAH. " +
  "Seja direto, use frases curtas, divida em passos pequenos, e evite parágrafos longos. " +
  "Responda em texto puro, sem formatação Markdown (sem asteriscos, sem #, sem listas com traço). " +
  "Quando receber contexto do app do usuário (lições ou flashcards já existentes), use isso pra manter " +
  "consistência com o que ele já estudou e pra sugerir lições relacionadas quando fizer sentido — mas sem " +
  "fugir do foco principal da pergunta.";

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

/** Pede explicação de um tópico do blueprint em um dos 4 estilos, com RAG sobre o próprio app. */
export async function explicarTopico(nomeTopico, modo = MODOS_EXPLICACAO.INICIANTE) {
  const instrucao = INSTRUCAO_POR_MODO[modo] || INSTRUCAO_POR_MODO.iniciante;
  const contextoRAG = await montarContextoRAG(nomeTopico);

  const prompt = contextoRAG
    ? `${instrucao}\n\nAssunto: ${nomeTopico} (blueprint CCNA 200-301).\n\n${contextoRAG}`
    : `${instrucao}\n\nAssunto: ${nomeTopico} (blueprint CCNA 200-301).`;

  const result = await model.generateContent(prompt);
  return result.response.text();
}

/** Explica em português o conteúdo de um trecho da página que o usuário está lendo no livro.
 * Não é tradução literal — é uma explicação didática dos conceitos, como assistente de estudo
 * sobre o material que o próprio usuário possui. */
export async function explicarTrechoLivro(trecho) {
  const prompt =
    "O texto a seguir é um trecho de uma página de um livro técnico de CCNA que estou lendo em inglês. " +
    "Explique em português brasileiro, com SUAS PRÓPRIAS PALAVRAS, os conceitos que esse trecho apresenta. " +
    "Não faça tradução literal frase a frase — resuma e ensine a ideia principal em tópicos curtos. " +
    "Mantenha comandos Cisco IOS, siglas e nomes de protocolo no original. " +
    "Se o trecho for só índice, cabeçalho ou legenda de figura, diga que não há conteúdo explicável nesta página.\n\n" +
    "--- TRECHO ---\n" +
    trecho;
  const result = await model.generateContent(prompt);
  return result.response.text();
}

/** Lista, em português, os termos técnicos / siglas / comandos que aparecem no
 * trecho da página — cada um com uma definição curta. Não traduz o trecho. */
export async function glossarioDoTrecho(trecho) {
  const prompt =
    "Abaixo está um trecho de uma página de um livro de CCNA em inglês. " +
    "Liste os termos técnicos, siglas e comandos Cisco IOS que aparecem nele. " +
    "Para cada um, escreva uma linha no formato 'TERMO — definição curta em português'. " +
    "Ordene do mais importante para o menos. Não traduza o trecho inteiro, só monte o glossário. " +
    "Se não houver termos técnicos relevantes, diga isso.\n\n" +
    "--- TRECHO ---\n" +
    trecho;
  const result = await model.generateContent(prompt);
  return result.response.text();
}

/** Pergunta livre pro tutor, com RAG buscando contexto relevante na sua própria Trilha.
 * `modo` e `contexto` agora influenciam de verdade o prompt (antes só existiam pra explicarTopico). */
export async function perguntarLivre(pergunta, modo = MODOS_EXPLICACAO.INICIANTE, contexto = null) {
  const instrucao = INSTRUCAO_POR_MODO[modo] || INSTRUCAO_POR_MODO.iniciante;
  const consultaRAG = contexto ? `${contexto} ${pergunta}` : pergunta;
  const contextoRAG = await montarContextoRAG(consultaRAG);

  const partes = [instrucao];
  if (contexto) partes.push(`Contexto desta conversa: ${contexto}.`);
  if (contextoRAG) partes.push(contextoRAG);
  partes.push(`Pergunta do usuário: ${pergunta}`);

  const prompt = partes.join("\n\n");
  const result = await model.generateContent(prompt);
  return result.response.text();
}
