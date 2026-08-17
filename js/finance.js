// finance.js
// Fachada do módulo financeiro — reexporta os submódulos de js/finance/*.js
// e mantém as funções de captura rápida (transações, gastos fixos, cartões,
// meta). Dividido em arquivos menores desde a Fase 2 da reformulação, pra
// não deixar tudo dependendo de um arquivo gigante só.

import {
  createTransacao,
  updateTransacao,
  getTransacoesByMonth,
  deleteTransacao,
  createGastoFixo,
  getGastosFixos,
  deleteGastoFixo,
  createCartao,
  getCartoes,
  deleteCartao,
  salvarMetaGasto,
  getMetaGasto,
} from "./data-schema.js";

export {
  GRUPOS,
  GRUPO_LABEL,
  GRUPOS_SAIDA,
  GRUPOS_ENTRADA,
  FORMAS_PAGAMENTO,
  OPCOES_PARCELAMENTO,
  OPCOES_RECORRENCIA,
  CATEGORIAS_PADRAO,
} from "./finance/constants.js";

export {
  anoMesDeHoje,
  formatarAnoMes,
  deslocarAnoMes,
  listarAnoMesEntre,
  faixaRapida,
  formatarMoeda,
  formatarDataBR,
} from "./finance/period.js";

export {
  seedCategoriasIfNeeded,
  listarCategorias,
  criarCategoria,
  editarCategoria,
  alternarAtivaCategoria,
  removerCategoria,
} from "./finance/categories.js";

import { anoMesDeHoje as _anoMesDeHoje } from "./finance/period.js";

/**
 * Registra uma transação. Aceita os campos novos (categoriaId, cartaoId,
 * parcela, totalParcelas, valorParcela, transacaoOriginalId, recorrente,
 * observacoes) além dos já existentes — todos opcionais, então chamadas
 * antigas continuam funcionando sem alteração (compatibilidade com a UI
 * atual, que será substituída na Fase 3).
 */
export async function adicionarTransacao(uid, dadosTransacao) {
  const {
    tipo,
    grupo,
    categoria, // texto livre legado — mantido por compatibilidade com dados antigos
    categoriaId, // novo: referência à coleção categoriasFinanceiras
    descricao,
    valor,
    formaPagamento,
    data,
    cartaoId,
    parcela,
    totalParcelas,
    valorParcela,
    transacaoOriginalId,
    recorrente,
    observacoes,
  } = dadosTransacao;

  const dataFinal = data || new Date().toISOString().slice(0, 10);

  return createTransacao(uid, {
    tipo, // "entrada" | "saida"
    grupo,
    categoria: categoria || "",
    ...(categoriaId ? { categoriaId } : {}),
    descricao: descricao || "",
    valor: Number(valor) || 0,
    formaPagamento: formaPagamento || "",
    data: dataFinal,
    anoMes: dataFinal.slice(0, 7),
    ...(cartaoId ? { cartaoId } : {}),
    ...(parcela ? { parcela: Number(parcela) } : {}),
    ...(totalParcelas ? { totalParcelas: Number(totalParcelas) } : {}),
    ...(valorParcela ? { valorParcela: Number(valorParcela) } : {}),
    ...(transacaoOriginalId ? { transacaoOriginalId } : {}),
    ...(recorrente !== undefined ? { recorrente: !!recorrente } : {}),
    ...(observacoes ? { observacoes } : {}),
  });
}

export async function editarTransacao(uid, transacaoId, dados) {
  return updateTransacao(uid, transacaoId, dados);
}

export async function duplicarTransacao(uid, transacao) {
  // eslint-disable-next-line no-unused-vars
  const { id, criadaEm, atualizadaEm, ...resto } = transacao;
  return createTransacao(uid, resto);
}

export async function removerTransacao(uid, id) {
  return deleteTransacao(uid, id);
}

/** Monta o resumo financeiro de um mês: total entrada, saída, saldo e por grupo. */
export async function getResumoDoMes(uid, anoMes = _anoMesDeHoje()) {
  const transacoes = await getTransacoesByMonth(uid, anoMes);

  const totalEntradas = transacoes.filter((t) => t.tipo === "entrada").reduce((acc, t) => acc + t.valor, 0);
  const totalSaidas = transacoes.filter((t) => t.tipo === "saida").reduce((acc, t) => acc + t.valor, 0);

  const porGrupo = {};
  transacoes
    .filter((t) => t.tipo === "saida")
    .forEach((t) => {
      porGrupo[t.grupo] = (porGrupo[t.grupo] || 0) + t.valor;
    });

  const porCategoria = {};
  transacoes
    .filter((t) => t.tipo === "saida" && (t.categoriaId || t.categoria))
    .forEach((t) => {
      const chave = t.categoriaId || t.categoria;
      porCategoria[chave] = (porCategoria[chave] || 0) + t.valor;
    });

  const meta = await getMetaGasto(uid, anoMes);

  return {
    anoMes,
    transacoes,
    totalEntradas,
    totalSaidas,
    saldo: totalEntradas - totalSaidas,
    porGrupo,
    porCategoria,
    metaGasto: meta?.valorLimite || null,
    percentualDaMeta: meta?.valorLimite ? Math.min(100, Math.round((totalSaidas / meta.valorLimite) * 100)) : null,
  };
}

// ---------- GASTOS FIXOS ----------

export async function adicionarGastoFixo(uid, { descricao, diaVencimento, valorMedio }) {
  return createGastoFixo(uid, { descricao, diaVencimento: Number(diaVencimento), valorMedio: Number(valorMedio) });
}

export async function listarGastosFixos(uid) {
  const gastos = await getGastosFixos(uid);
  return gastos.sort((a, b) => a.diaVencimento - b.diaVencimento);
}

export async function removerGastoFixo(uid, id) {
  return deleteGastoFixo(uid, id);
}

// ---------- CARTÕES ----------

export async function adicionarCartao(uid, { nome, vencimento, fechamento }) {
  return createCartao(uid, { nome, vencimento: Number(vencimento), fechamento: Number(fechamento) });
}

export async function listarCartoes(uid) {
  return getCartoes(uid);
}

export async function removerCartao(uid, id) {
  return deleteCartao(uid, id);
}

// ---------- META DE GASTO ----------

export async function definirMetaGasto(uid, valorLimite, anoMes = _anoMesDeHoje()) {
  return salvarMetaGasto(uid, anoMes, Number(valorLimite));
}

