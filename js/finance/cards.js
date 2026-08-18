// finance/cards.js
// Cartões de crédito, com lógica de fatura respeitando o dia de fechamento:
// compra feita DEPOIS do fechamento cai na fatura do mês seguinte.

import { createCartao, getCartoes, deleteCartao, updateCartao, getTransacoesByMonth } from "../data-schema.js";
import { deslocarAnoMes } from "./period.js";

export async function adicionarCartaoCompleto(uid, dados) {
  return createCartao(uid, {
    nome: dados.nome,
    bandeira: dados.bandeira || "",
    limiteTotal: dados.limiteTotal ? Number(dados.limiteTotal) : null,
    fechamento: Number(dados.fechamento),
    vencimento: Number(dados.vencimento),
    ativo: true,
  });
}

export async function listarCartoesCompleto(uid) {
  return getCartoes(uid);
}

export async function editarCartao(uid, cartaoId, dados) {
  return updateCartao(uid, cartaoId, dados);
}

export async function removerCartaoCompleto(uid, cartaoId) {
  return deleteCartao(uid, cartaoId);
}

/** Determina em qual fatura ("YYYY-MM") uma compra cai, dado o dia de fechamento do cartão. */
export function cicloDaTransacao(dataIso, diaFechamento) {
  const [ano, mes, dia] = dataIso.split("-").map(Number);
  if (dia <= diaFechamento) {
    return `${ano}-${String(mes).padStart(2, "0")}`;
  }
  const proximoMes = new Date(ano, mes, 1); // mes já é 1-indexed no input -> avança certo
  return `${proximoMes.getFullYear()}-${String(proximoMes.getMonth() + 1).padStart(2, "0")}`;
}

/**
 * Busca as transações que caem na fatura de `anoMesCiclo` desse cartão.
 * Consulta o mês do ciclo + o mês anterior, pra capturar compras feitas no
 * fim do mês anterior que ainda pertencem a essa fatura (por causa do dia
 * de fechamento).
 */
export async function buscarFaturaCartao(uid, cartao, anoMesCiclo) {
  const mesAnterior = deslocarAnoMes(anoMesCiclo, -1);
  const [transAtual, transAnterior] = await Promise.all([
    getTransacoesByMonth(uid, anoMesCiclo),
    getTransacoesByMonth(uid, mesAnterior),
  ]);

  const todas = [...transAtual, ...transAnterior];
  const daFatura = todas.filter(
    (t) => t.cartaoId === cartao.id && t.formaPagamento === "Crédito" && cicloDaTransacao(t.data, cartao.fechamento) === anoMesCiclo
  );

  const total = daFatura.reduce((acc, t) => acc + t.valor, 0);
  return { transacoes: daFatura.sort((a, b) => (a.data < b.data ? 1 : -1)), total };
}

export function cicloAtualDoCartao(cartao) {
  const hoje = new Date();
  const anoMesHoje = `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, "0")}`;
  return cicloDaTransacao(hoje.toISOString().slice(0, 10), cartao.fechamento) === anoMesHoje
    ? anoMesHoje
    : deslocarAnoMes(anoMesHoje, 1);
}
