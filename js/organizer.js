// organizer.js
// Organiza as tarefas do dia em 3 áreas: trabalho, estudo, bem-estar.
// Princípio TDAH: captura rápida (sem formulário longo), poucos itens visíveis,
// bem-estar tem sugestões prontas pra reduzir o esforço de decidir o que anotar.

import { createTarefa, getTarefasByDate, toggleTarefaConcluida, deleteTarefa, editarTituloTarefa } from "./data-schema.js";

export const CATEGORIAS = {
  TRABALHO: "trabalho",
  ESTUDO: "estudo",
  BEMESTAR: "bemestar",
};

export const CATEGORIA_LABEL = {
  trabalho: "Trabalho",
  estudo: "Estudo",
  bemestar: "Bem-estar",
};

// Sugestões rápidas pra bem-estar — toque e já cria, sem precisar digitar.
// Reduz a barreira de "lembrar de cuidar de mim" quando a mente já está sobrecarregada.
export const SUGESTOES_BEMESTAR = [
  "Beber água",
  "Pausa de 10 min sem tela",
  "Alongar o corpo",
  "Comer algo",
  "Sair pra tomar sol",
  "Dormir no horário",
];

function todayKey() {
  return new Date().toISOString().slice(0, 10);
}

/** Cria uma tarefa rápida pra hoje (ou pra uma data específica). */
export async function adicionarTarefa(uid, titulo, categoria, dataAlvo = todayKey()) {
  if (!titulo?.trim()) return null;
  return createTarefa(uid, { titulo: titulo.trim(), categoria, dataAlvo });
}

/** Busca e agrupa as tarefas do dia pelas 3 categorias. */
export async function getTarefasDeHoje(uid) {
  const dataAlvo = todayKey();
  const tarefas = await getTarefasByDate(uid, dataAlvo);

  const agrupadas = {
    trabalho: tarefas.filter((t) => t.categoria === CATEGORIAS.TRABALHO),
    estudo: tarefas.filter((t) => t.categoria === CATEGORIAS.ESTUDO),
    bemestar: tarefas.filter((t) => t.categoria === CATEGORIAS.BEMESTAR),
  };

  const totalTarefas = tarefas.length;
  const totalConcluidas = tarefas.filter((t) => t.concluida).length;

  return {
    agrupadas,
    todasTarefas: tarefas,
    totalTarefas,
    totalConcluidas,
    percentualConcluido: totalTarefas ? Math.round((totalConcluidas / totalTarefas) * 100) : 0,
  };
}

export async function marcarConcluida(uid, tarefaId, concluida) {
  return toggleTarefaConcluida(uid, tarefaId, concluida);
}

export async function removerTarefa(uid, tarefaId) {
  return deleteTarefa(uid, tarefaId);
}

export async function editarTarefa(uid, tarefaId, novoTitulo) {
  if (!novoTitulo?.trim()) return null;
  return editarTituloTarefa(uid, tarefaId, novoTitulo.trim());
}
