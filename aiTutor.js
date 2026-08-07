// functions/aiTutor.js
// Cloud Function callable — a chave da Anthropic API fica só aqui, nunca no frontend.
//
// Setup:
// 1. firebase functions:config:set anthropic.key="SUA_CHAVE_AQUI"
//    (ou, no 2nd gen, use variável de ambiente / Secret Manager: firebase functions:secrets:set ANTHROPIC_API_KEY)
// 2. Deploy: firebase deploy --only functions:aiTutor

const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { defineSecret } = require("firebase-functions/params");

const ANTHROPIC_API_KEY = defineSecret("ANTHROPIC_API_KEY");

// Os 4 modos de explicação pedidos no projeto original.
const MODOS = {
  iniciante: "Explique como se eu fosse totalmente iniciante em redes, sem jargão técnico, usando passo a passo simples.",
  tecnico: "Explique de forma técnica e precisa, como faria um instrutor Cisco experiente, incluindo termos corretos.",
  analogia: "Explique usando uma analogia do dia a dia que torne o conceito fácil de lembrar.",
  prova: "Explique focando exatamente em como a Cisco cobra esse assunto na prova CCNA 200-301, incluindo pegadinhas comuns.",
};

exports.aiTutor = onCall({ secrets: [ANTHROPIC_API_KEY], cors: true }, async (request) => {
  const { topico, modo, perguntaLivre } = request.data;

  if (!request.auth) {
    throw new HttpsError("unauthenticated", "Login necessário.");
  }
  if (!topico && !perguntaLivre) {
    throw new HttpsError("invalid-argument", "Envie 'topico' ou 'perguntaLivre'.");
  }

  const instrucaoModo = MODOS[modo] || MODOS.iniciante;
  const prompt = perguntaLivre
    ? perguntaLivre
    : `${instrucaoModo}\n\nAssunto: ${topico} (blueprint CCNA 200-301).`;

  const resp = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": ANTHROPIC_API_KEY.value(),
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: "claude-sonnet-4-6",
      max_tokens: 1000,
      system:
        "Você é um instrutor Cisco CCNA 200-301 explicando para um estudante com TDAH. " +
        "Seja direto, use frases curtas, divida em passos pequenos, e evite parágrafos longos.",
      messages: [{ role: "user", content: prompt }],
    }),
  });

  if (!resp.ok) {
    const errText = await resp.text();
    throw new HttpsError("internal", `Erro na Anthropic API: ${errText}`);
  }

  const data = await resp.json();
  const texto = data.content?.find((b) => b.type === "text")?.text || "";

  return { resposta: texto, modo: modo || "iniciante" };
});
