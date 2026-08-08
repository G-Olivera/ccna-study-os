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
