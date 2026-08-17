// finance/categories.js
// Categorias são independentes de Grupo: representam "onde o dinheiro foi
// usado" (Alimentação, Transporte...), enquanto Grupo é o "tipo financeiro"
// do lançamento (Fixo, Variável, Receita...). O usuário pode criar, editar,
// excluir e ativar/desativar categorias livremente.

import {
  createCategoriaFinanceira,
  getCategoriasFinanceiras,
  updateCategoriaFinanceira,
  deleteCategoriaFinanceira,
} from "../data-schema.js";
import { CATEGORIAS_PADRAO } from "./constants.js";

/** Cria as categorias sugeridas no primeiro uso (só roda se o usuário ainda não tiver nenhuma). */
export async function seedCategoriasIfNeeded(uid) {
  const existentes = await getCategoriasFinanceiras(uid);
  if (existentes.length > 0) return { seeded: false };

  for (const cat of CATEGORIAS_PADRAO) {
    await createCategoriaFinanceira(uid, { ...cat, ativa: true, criadaEm: new Date().toISOString() });
  }
  return { seeded: true, count: CATEGORIAS_PADRAO.length };
}

export async function listarCategorias(uid, incluirInativas = false) {
  const categorias = await getCategoriasFinanceiras(uid);
  const ordenadas = categorias.sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
  return incluirInativas ? ordenadas : ordenadas.filter((c) => c.ativa !== false);
}

export async function criarCategoria(uid, nome, icone = "📦") {
  return createCategoriaFinanceira(uid, { nome, icone, ativa: true, criadaEm: new Date().toISOString() });
}

export async function editarCategoria(uid, categoriaId, dados) {
  return updateCategoriaFinanceira(uid, categoriaId, dados);
}

export async function alternarAtivaCategoria(uid, categoriaId, ativaAtual) {
  return updateCategoriaFinanceira(uid, categoriaId, { ativa: !ativaAtual });
}

export async function removerCategoria(uid, categoriaId) {
  return deleteCategoriaFinanceira(uid, categoriaId);
}
