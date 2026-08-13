// finance.js
// Controle financeiro pessoal — captura rápida, resumo do mês, gastos fixos,
// cartões e meta de gasto. Inspirado na estrutura que você já usa e valida
// numa planilha pessoal (grupos, tipos, formas de pagamento).

import {
  createTransacao,
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

export const GRUPOS = {
  FIXOS: "fixos",
  ASSINATURA: "assinatura",
  VARIAVEIS: "variaveis",
  TEMPORARIAS: "temporarias",
  FATURA: "fatura",
  RECEITA: "receita",
};

export const GRUPO_LABEL = {
  fixos: "🏠 Gastos Fixos",
  assinatura: "📺 Assinatura",
  variaveis: "💸 Gastos Variáveis",
  temporarias: "🧾 Despesas Temporárias",
  fatura: "💳 Pagamento de Fatura",
  receita: "💵 Ganhos",
};

export const FORMAS_PAGAMENTO = ["Débito", "Crédito", "Pix", "Dinheiro"];

function anoMesDeHoje() {
  return new Date().toISOString().slice(0, 7); // "YYYY-MM"
}

/** Registra uma transação rápida (entrada ou saída). */
export async function adicionarTransacao(uid, { tipo, grupo, categoria, descricao, valor, formaPagamento, data }) {
  const dataFinal = data || new Date().toISOString().slice(0, 10);
  return createTransacao(uid, {
    tipo, // "entrada" | "saida"
    grupo,
    categoria: categoria || "",
    descricao: descricao || "",
    valor: Number(valor) || 0,
    formaPagamento: formaPagamento || "",
    data: dataFinal,
    anoMes: dataFinal.slice(0, 7),
  });
}

export async function removerTransacao(uid, id) {
  return deleteTransacao(uid, id);
}

/** Monta o resumo financeiro de um mês: total entrada, saída, saldo e por grupo. */
export async function getResumoDoMes(uid, anoMes = anoMesDeHoje()) {
  const transacoes = await getTransacoesByMonth(uid, anoMes);

  const totalEntradas = transacoes.filter((t) => t.tipo === "entrada").reduce((acc, t) => acc + t.valor, 0);
  const totalSaidas = transacoes.filter((t) => t.tipo === "saida").reduce((acc, t) => acc + t.valor, 0);

  const porGrupo = {};
  transacoes
    .filter((t) => t.tipo === "saida")
    .forEach((t) => {
      porGrupo[t.grupo] = (porGrupo[t.grupo] || 0) + t.valor;
    });

  const meta = await getMetaGasto(uid, anoMes);

  return {
    anoMes,
    transacoes,
    totalEntradas,
    totalSaidas,
    saldo: totalEntradas - totalSaidas,
    porGrupo,
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

export async function definirMetaGasto(uid, valorLimite, anoMes = anoMesDeHoje()) {
  return salvarMetaGasto(uid, anoMes, Number(valorLimite));
}
