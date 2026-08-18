// finance/budgets.js
// Metas de orçamento — geral (já existia), por grupo e por categoria.
// Alertas nunca dependem só de cor (também têm ícone + texto).

import { salvarMetaGrupo, getMetasGrupo, salvarMetaCategoria, getMetasCategoria } from "../data-schema.js";

export function nivelAlerta(percentual) {
  if (percentual > 100) return { nivel: "estourado", label: "🔴 Estourado", cor: "var(--terracotta)" };
  if (percentual >= 90) return { nivel: "critico", label: "🟠 Crítico", cor: "var(--terracotta)" };
  if (percentual >= 70) return { nivel: "atencao", label: "🟡 Atenção", cor: "var(--amber)" };
  return { nivel: "normal", label: "🟢 Normal", cor: "var(--sage)" };
}

export async function definirMetaPorGrupo(uid, anoMes, grupo, valorLimite) {
  return salvarMetaGrupo(uid, anoMes, grupo, Number(valorLimite));
}

export async function listarMetasPorGrupo(uid, anoMes) {
  const metas = await getMetasGrupo(uid, anoMes);
  return Object.fromEntries(metas.map((m) => [m.grupo, m.valorLimite]));
}

export async function definirMetaPorCategoria(uid, anoMes, categoriaId, valorLimite) {
  return salvarMetaCategoria(uid, anoMes, categoriaId, Number(valorLimite));
}

export async function listarMetasPorCategoria(uid, anoMes) {
  const metas = await getMetasCategoria(uid, anoMes);
  return Object.fromEntries(metas.map((m) => [m.categoriaId, m.valorLimite]));
}
