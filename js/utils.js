// utils.js
// Funções pequenas e compartilhadas entre módulos.

/**
 * Escapa caracteres HTML especiais antes de inserir texto vindo do usuário
 * (ou de qualquer fonte não confiável) em innerHTML. Previne XSS armazenado —
 * sem isso, alguém poderia digitar "<img src=x onerror=...>" como título de
 * tarefa, por exemplo, e esse código executaria toda vez que a lista carregasse.
 */
export function escapeHtml(texto) {
  if (texto == null) return "";
  return String(texto)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

/**
 * Só deixa passar um #rgb / #rrggbb válido pra dentro de um atributo style="" —
 * impede injeção de CSS via valor manipulado (ex.: "red;background:url(...)").
 */
export function corHexSegura(valor, fallback = "#3E6B6B") {
  return typeof valor === "string" && /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(valor.trim())
    ? valor.trim()
    : fallback;
}
